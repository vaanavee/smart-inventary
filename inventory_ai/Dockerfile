# Python image shared by TWO compose services:
#   - api      : FastAPI inventory API            (port 8000)
#   - monitor  : Monitor-AI camera + RT-DETR svc  (port 5001)
# Both run from this same codebase; the command is overridden per service.
FROM python:3.11-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# System libs required by opencv-python (cv2)
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-only torch/torchvision from the PyTorch CPU index to avoid the
# multi-GB CUDA wheels. The versions match requirements.txt, so the subsequent
# `-r requirements.txt` sees them already satisfied and won't re-pull them.
COPY requirements.txt ./
RUN pip install torch==2.3.1 torchvision==0.18.1 \
        --index-url https://download.pytorch.org/whl/cpu \
    && pip install -r requirements.txt

# App source (backend/, database/, dataset/, etc.)
COPY . .

# 8000 = FastAPI inventory API, 5001 = Monitor-AI service
EXPOSE 8000 5001

# Default command = inventory API. The monitor service overrides this in compose.
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
