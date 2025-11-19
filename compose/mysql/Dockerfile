FROM mysql:8.0.42-debian

ARG MYSQL_DATABASE
ARG MYSQL_USER
ARG MYSQL_PASSWORD
ARG MYSQL_ROOT_PASSWORD

# (1) MySQLリポジトリ修正と必須ツールインストール
RUN \
    mv /etc/apt/sources.list.d/mysql.list /tmp/mysql.list.bak && \
    apt-get update && \
    apt-get install -y --no-install-recommends wget gnupg lsb-release debconf-utils ca-certificates

# (2) mysql-apt-config の修正版インストール
RUN \
    echo 'mysql-apt-config mysql-apt-config/select-server select mysql-8.0' | debconf-set-selections && \
    echo 'mysql-apt-config mysql-apt-config/select-connector-python select none' | debconf-set-selections && \
    echo 'mysql-apt-config mysql-apt-config/select-tools select none' | debconf-set-selections && \
    echo 'mysql-apt-config mysql-apt-config/select-router select none' | debconf-set-selections && \
    wget https://dev.mysql.com/get/mysql-apt-config_0.8.35-1_all.deb -O /tmp/mysql-apt-config.deb && \
    DEBIAN_FRONTEND=noninteractive dpkg -i /tmp/mysql-apt-config.deb && \
    rm /tmp/mysql-apt-config.deb

# (3) localesインストール
RUN \
    apt-get update && \
    apt-get install -y --no-install-recommends locales

# (4) ロケール設定
RUN \
    sed -i -e 's/# ja_JP.UTF-8 UTF-8/ja_JP.UTF-8 UTF-8/' /etc/locale.gen && \
    locale-gen && \
    update-locale LANG=ja_JP.UTF-8

# (5) クリーンアップ
RUN \
    apt-get purge -y --auto-remove wget gnupg lsb-release debconf-utils ca-certificates && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

ENV LANG ja_JP.UTF-8
ENV LANGUAGE ja_JP:ja
ENV LC_ALL ja_JP.UTF-8
ENV TZ JST-9

RUN mkdir /backups

CMD ["mysqld"]