import os
import json
import time
import logging
import pika
import psycopg2
from psycopg2.extras import execute_values

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")
logger = logging.getLogger("telemetry-worker")
logging.getLogger("pika").setLevel(logging.WARNING)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:alphaflight7@drone-postgres:5432/postgres")
RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "rabbitmq")

def get_db_connection():
    try:
        return psycopg2.connect(DATABASE_URL)
    except psycopg2.OperationalError as e:
        logger.error(f"Database connection failed: {e}")
        return None

def setup_rabbitmq():
    connection = pika.BlockingConnection(pika.ConnectionParameters(host=RABBITMQ_HOST))
    channel = connection.channel()
    
    # 1. Setup the Dead Letter Exchange (The Quarantine Zone)
    channel.exchange_declare(exchange='dlx_telemetry', exchange_type='direct')
    channel.queue_declare(queue='telemetry_dead_letter')
    channel.queue_bind(exchange='dlx_telemetry', queue='telemetry_dead_letter', routing_key='quarantine')

    # 2. Setup the Main Queue to route failures to the Quarantine Zone
    args = {
        'x-dead-letter-exchange': 'dlx_telemetry',
        'x-dead-letter-routing-key': 'quarantine'
    }
    channel.queue_declare(queue='uav_telemetry', durable=True, arguments=args)
    
    return connection, channel

def process_message(ch, method, properties, body):
    payload = json.loads(body)
    conn = get_db_connection()
    
    if not conn:
        logger.warning(f"DB offline. Rejecting packet for {payload.get('drone_id')}. Routing to Dead Letter Queue.")
        # requeue=False combined with our setup forces it into the DLQ!
        ch.basic_reject(delivery_tag=method.delivery_tag, requeue=False)
        return

    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO drone_telemetry_records 
                (drone_id, timestamp, flight_dynamics, propulsion_systems, tactical_sensors)
                VALUES (%s, %s, %s, %s, %s)
            """, (
                payload['drone_id'],
                payload['timestamp'],
                json.dumps(payload['flight_dynamics']),
                json.dumps(payload['propulsion_systems']),
                json.dumps(payload['tactical_sensors'])
            ))
        conn.commit()
        ch.basic_ack(delivery_tag=method.delivery_tag)
        logger.info(f"Successfully persisted telemetry for {payload.get('drone_id')}")
    except Exception as e:
        logger.error(f"Failed to insert record: {e}. Routing to Dead Letter Queue.")
        conn.rollback()
        ch.basic_reject(delivery_tag=method.delivery_tag, requeue=False)
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    logger.info("Starting telemetry persistence worker...")
    time.sleep(5) # Give RabbitMQ time to boot
    
    while True:
        try:
            connection, channel = setup_rabbitmq()
            channel.basic_qos(prefetch_count=50) # Batch processing limits
            channel.basic_consume(queue='uav_telemetry', on_message_callback=process_message)
            logger.info("Worker actively consuming from uav_telemetry queue.")
            channel.start_consuming()
        except pika.exceptions.AMQPConnectionError:
            logger.error("RabbitMQ connection lost. Retrying in 5 seconds...")
            time.sleep(5)
        except Exception as e:
            logger.critical(f"Worker crashed: {e}")
            time.sleep(5)