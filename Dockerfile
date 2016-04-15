FROM python:2.7-alpine

RUN mkdir /app
WORKDIR /app

RUN apk add --update git && rm -rf /var/cache/apk/*

COPY requirements.txt /app
RUN pip install --no-cache-dir -r requirements.txt

RUN git clone --depth 1 https://github.com/wdas/reposado && \
    cp -R reposado/code/reposadolib reposadolib && \
    rm -rf reposado

COPY . /app
CMD python margarita.py -p 5000
