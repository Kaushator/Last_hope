FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04
RUN apt-get update && apt-get install -y python3-pip git && rm -rf /var/lib/apt/lists/*
RUN pip3 install --upgrade pip
RUN pip3 install fastapi uvicorn torch --index-url https://download.pytorch.org/whl/cu121
COPY apps/backend/htx_interface/services/fingpt_server.py /srv/fingpt_server.py
EXPOSE 9000
CMD ["uvicorn","/srv/fingpt_server.py:app","--host","0.0.0.0","--port","9000"]
