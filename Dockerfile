FROM tiangolo/uwsgi-nginx-flask:python2.7

WORKDIR /app

COPY requirements.txt /app
COPY margarita /app
COPY saml /app

RUN apt-get update -y && apt-get upgrade -y && apt-get -y install libxmlsec1-dev
RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 8089
