FROM python:3.13-alpine

# 必要なライブラリ（libusb）をインストール
RUN apk add --no-cache libusb

ENV PYTHONDONTWRITEBYTECODE=1 \
	PYTHONUNBUFFERED=1 \
	LANG=C.UTF-8 \
	TZ=Asia/Tokyo

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip && \
	pip install -r requirements.txt

COPY . .

CMD ["python", "main.py"]