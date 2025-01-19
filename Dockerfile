FROM python:3.11.2-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire application
COPY . .

# Set environment variables
ENV DEBUG=false
ENV PORT=8000
ENV PYTHONPATH=/app

# Create necessary directories if they don't exist
RUN mkdir -p /app/app/static/images

# Make sure app directory is a Python package
RUN touch /app/app/__init__.py

# Expose the port
EXPOSE 8000

# Command to run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4", "--log-level", "debug"]