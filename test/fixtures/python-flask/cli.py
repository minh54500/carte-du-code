# Command line tool.
from .services import db
if __name__ == '__main__':
    print(db.get_orders())
