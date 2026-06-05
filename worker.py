import os
import time
import json
import pika
import psycopg2


DB_DSN = os.getenv("DATABASE_URL", "postgresql://postgres:alphaflight7@drone-postgres:5432/postgres")
RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "rabbitmq")
QUEUE_NAME = "uav_telemetry"

def get_db_connection():
    """Attempts to establish a stable connection with PostgreSQL."""
    while True:
        try:
            conn = psycopg2.connect(DB_DSN)
            return conn
        except psycopg2.OperationalError as e:
            print(f"[Worker DB] Waiting for database... ({e})")
            time.sleep(2)

def process_message(ch, method, properties, body):
    """Callback function triggered whenever a new payload is consumed from the queue."""
    try:
        payload = json.loads(body.decode('utf-8'))
        drone_id = payload.get("drone_id", "UNKNOWN")
        timestamp = payload.get("timestamp", int(time.time()))
        
        print(f"[Worker] Processing telemetry packet for Drone: {drone_id}")
        
       
        flight_dynamics = json.dumps(payload.get("flight_dynamics", {}))
        propulsion_systems = json.dumps(payload.get("propulsion_systems", {}))
        tactical_sensors = json.dumps(payload.get("tactical_sensors", {}))
        
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO drone_telemetry_records (drone_id, timestamp, flight_dynamics, propulsion_systems, tactical_sensors)
                VALUES (%s, %s, %s, %s, %s);
                """,
                (drone_id, timestamp, flight_dynamics, propulsion_systems, tactical_sensors)
            )
            conn.commit()
        conn.close()
        
        ch.basic_ack(delivery_tag=method.delivery_tag)
        print(f"[Worker] Telemetry successfully committed to PostgreSQL for Drone: {drone_id}")
        
    except Exception as e:
        print(f"[Worker Error] Failed to process incoming telemetry payload: {e}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

def main():
    """Connects to RabbitMQ Broker and begins consumption loop."""
    print("Background Worker starting up...")
    
    
    while True:
        try:
            print(f"[Worker] Connecting to RabbitMQ Broker at host: {RABBITMQ_HOST}")
            connection = pika.BlockingConnection(
                pika.ConnectionParameters(
                    host=RABBITMQ_HOST,
                    heartbeat=600,
                    blocked_connection_timeout=300
                )
            )
            channel = connection.channel()
            
           
            channel.queue_declare(queue=QUEUE_NAME, durable=True)
            break
        except pika.exceptions.AMQPConnectionError:
            print("RabbitMQ Broker is unavailable... retrying in 3 seconds.")
            time.sleep(3)

  
    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(queue=QUEUE_NAME, on_message_callback=process_message)
    
    print("Background Worker online and listening for inbound queue logs. Press Ctrl+C to exit.")
    
    
    while True:
        try:
            channel.start_consuming()
        except KeyboardInterrupt:
            print("[Worker] Shutting down container channel gracefully.")
            channel.stop_consuming()
            break
        except pika.exceptions.AMQPConnectionError:
            print("[Worker] Connection lost. Attempting to reconnect execution context...")
            time.sleep(5)
            continue
        except Exception as e:
            print(f"[Worker Loop Error] Unexpected termination: {e}")
            time.sleep(5)
            continue

if __name__ == "__main__":
    main()