# UAV Aviation Telemetry Pipeline

An event-driven, decoupled microservice architecture designed to ingest, queue, and persistently store high-frequency telemetry data from a multi-drone fleet. 

Built with an emphasis on asynchronous processing, backpressure management, and observable system health, this pipeline ensures zero data loss even during peak transmission spikes.

## 🏗️ Architecture & Tech Stack

This project implements a classic API-to-Worker pattern using the following technologies:
* **API Gateway:** FastAPI (Python) - Handles data validation, schema enforcement, and rapid ingestion.
* **Message Broker:** RabbitMQ - Queues incoming telemetry payloads to decouple the API from database write speeds.
* **Background Worker:** Python (`pika` & `psycopg2`) - Asynchronously consumes queue messages and handles database commits.
* **Database:** PostgreSQL - Utilizes `JSONB` columns to efficiently store nested, schemaless telemetry metrics alongside relational metadata.
* **Orchestration:** Docker & Docker Compose - Containerizes all services into a single, deployable network.

## ✨ Key Features
* **Asynchronous Ingestion:** The API responds with `202 Accepted` instantly, offloading the heavy database writes to the background worker.
* **Strict Payload Validation:** Enforces aviation-grade schemas (Altitude, Pitch/Roll/Yaw, GPS, Battery states) using Pydantic.
* **Multi-Drone Tracking:** Dynamically segregates and tracks telemetry history across multiple unique drone identifiers.
* **System Observability:** Includes a dedicated heartbeat endpoint to monitor the active connection states of the API, Message Broker, and Database.
* **Automated Threat Detection:** The API evaluates incoming payloads for critical battery levels or proximity alerts in real-time before queuing.

## 🚀 Quick Start Guide

### Prerequisites
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.
* Git installed.

### Installation
1. Clone the repository:
   ```bash
   git clone [https://github.com/harshatentu05-spec/UAV-Telemetry-Injestion.git](https://github.com/harshatentu05-spec/UAV-Telemetry-Injestion.git)
   cd UAV-Telemetry-Injestion