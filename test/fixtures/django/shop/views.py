from .models import Dish

def menu(request):
    return Dish.objects.all()
