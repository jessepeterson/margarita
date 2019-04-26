FROM tiangolo/uwsgi-nginx-flask:python2.7

COPY margarita /app
COPY requirements.txt /app/
COPY saml /app/

RUN git clone https://github.com/wdas/reposado
RUN ln -s /app/reposado/code/reposadolib /app/main/

RUN apt-get update -y && apt-get upgrade -y && apt-get -y install libxmlsec1-dev
RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 8089
