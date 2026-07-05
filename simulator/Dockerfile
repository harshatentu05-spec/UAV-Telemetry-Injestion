FROM python:3.11-slim
WORKDIR /app
RUN pip install requests
COPY load_test.py .
CMD ["python", "load_test.py"]