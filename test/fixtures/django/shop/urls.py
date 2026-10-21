from django.urls import path
from . import views

urlpatterns = [path('menu/', views.menu), path('', views.menu)]
