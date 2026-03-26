FROM python:3.12-slim

WORKDIR /app

# Install system build tools (needed by some Python packages)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies first (layer cache friendly)
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source files
COPY api_main.py \
     ai_nodes.py \
     config.py \
     graph_app.py \
     prompts.py \
     schemas.py \
     ./

# Expose the AI service port
EXPOSE 8000

# Start the FastAPI app with uvicorn
CMD ["uvicorn", "api_main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
