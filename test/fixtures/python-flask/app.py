"""Web app: health check and orders."""
from flask import Flask
from services.db import get_orders
app = Flask(__name__)

@app.route('/health')
def health():
    return 'ok'

@app.get('/orders')
def orders():
    return get_orders()
