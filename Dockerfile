FROM tiangolo/uwsgi-nginx-flask:python2.7

COPY margarita /app
COPY requirements.txt /app/
COPY saml /app/

RUN ln -s /reposado/code/reposadolib /app/
RUN ln -s /reposado/code/preferences.plist /app/

RUN apt-get update -y && apt-get upgrade -y && apt-get -y install libxmlsec1-dev
RUN pip install --no-cache-dir -r requirements.txt

HEALTHCHECK --interval=5s --timeout=2s --retries=12 \
  CMD curl --silent --fail localhost:9200/_cluster/health || exit 1

EXPOSE 80
