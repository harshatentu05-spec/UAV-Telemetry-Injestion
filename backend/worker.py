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

# --- BATCH SETTINGS ---
BATCH_SIZE = 100
message_buffer = []

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

def flush_buffer_to_db(ch):
    global message_buffer
    if not message_buffer:
        return

    tags = [msg['tag'] for msg in message_buffer]
    records = [msg['record'] for msg in message_buffer]

    conn = get_db_connection()
    if not conn:
        logger.error("DB offline. Routing entire batch to DLQ.")
        for tag in tags:
            ch.basic_reject(delivery_tag=tag, requeue=False)
        message_buffer.clear()
        return

    try:
        with conn.cursor() as cur:
            query = """
                INSERT INTO drone_telemetry_records 
                (drone_id, timestamp, flight_dynamics, propulsion_systems, tactical_sensors)
                VALUES %s
            """
            execute_values(cur, query, records)
        conn.commit()

        for tag in tags:
            ch.basic_ack(delivery_tag=tag)

        logger.info(f"Successfully bulk-persisted {len(records)} records.")

    except Exception as e:
        logger.error(f"Bulk insert failed: {e}. Routing entire batch to DLQ.")
        conn.rollback()
        for tag in tags:
            ch.basic_reject(delivery_tag=tag, requeue=False)
    finally:
        if conn:
            conn.close()
        message_buffer.clear()

def process_message(ch, method, properties, body):
    global message_buffer
    try:
        payload = json.loads(body)

        # Map incoming packet structure (location & telemetry) to DB columns
        loc = payload.get('location', {})
        tel = payload.get('telemetry', {})

        flight_dynamics = {
            "lat": loc.get("lat"),
            "lng": loc.get("lng"),
            "altitude_m": loc.get("altitude_m"),
            "speed_mps": tel.get("speed_mps")
        }
        propulsion_systems = {
            "battery_pct": tel.get("battery_pct"),
            "operational_state": tel.get("operational_state")
        }
        tactical_sensors = {
            "active_order": tel.get("active_order"),
            "destination": tel.get("destination")
        }

        record = (
            payload.get('device_id'),
            payload.get('timestamp', time.time()),
            json.dumps(flight_dynamics),
            json.dumps(propulsion_systems),
            json.dumps(tactical_sensors)
        )

        message_buffer.append({
            'tag': method.delivery_tag,
            'record': record
        })

        if len(message_buffer) >= BATCH_SIZE:
            flush_buffer_to_db(ch)

    except Exception as e:
        logger.error(f"Failed to parse or buffer message: {e}")
        ch.basic_reject(delivery_tag=method.delivery_tag, requeue=False)

if __name__ == "__main__":
    logger.info("Starting High-Performance telemetry worker...")
    time.sleep(5)

    while True:
        try:
            connection, channel = setup_rabbitmq()
            channel.basic_qos(prefetch_count=BATCH_SIZE)
            channel.basic_consume(queue='uav_telemetry', on_message_callback=process_message)
            logger.info("Worker actively consuming from uav_telemetry queue.")
            channel.start_consuming()
        except pika.exceptions.AMQPConnectionError:
            logger.error("RabbitMQ connection lost. Retrying in 5 seconds...")
            time.sleep(5)
        except Exception as e:
            logger.critical(f"Worker crashed: {e}")
            time.sleep(5)