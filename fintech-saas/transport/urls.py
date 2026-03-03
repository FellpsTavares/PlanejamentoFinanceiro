from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VehicleViewSet, TransportRevenueViewSet, TransportExpenseViewSet, TripViewSet

router = DefaultRouter()
router.register(r'vehicles', VehicleViewSet, basename='vehicle')
router.register(r'revenues', TransportRevenueViewSet, basename='transportrevenue')
router.register(r'expenses', TransportExpenseViewSet, basename='transportexpense')
router.register(r'trips', TripViewSet, basename='trip')

urlpatterns = [
    path('', include(router.urls)),
]
