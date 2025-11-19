FROM alpine:3.19

# mysql-client, bash, python3 をインストール
RUN apk add --no-cache mysql-client bash python3 tzdata

ENV TZ=Asia/Tokyo

WORKDIR /backups

# スクリプトをコピー
COPY menu /usr/local/bin/menu
COPY upload_server.py /usr/local/bin/upload_server.py

RUN chmod +x /usr/local/bin/menu \
    && chmod +x /usr/local/bin/upload_server.py

