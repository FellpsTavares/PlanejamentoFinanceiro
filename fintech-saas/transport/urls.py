from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    VehicleViewSet,
    TransportRevenueViewSet,
    TransportExpenseViewSet,
    TripViewSet,
    TireInventoryViewSet,
    VehicleTirePlacementViewSet,
    MaintenanceLogViewSet,
    OilChangeLogViewSet,
    MaintenanceAlertViewSet,
)

router = DefaultRouter()
router.register(r'vehicles', VehicleViewSet, basename='vehicle')
router.register(r'revenues', TransportRevenueViewSet, basename='transportrevenue')
router.register(r'expenses', TransportExpenseViewSet, basename='transportexpense')
router.register(r'trips', TripViewSet, basename='trip')
router.register(r'tires', TireInventoryViewSet, basename='tireinventory')
router.register(r'tire-placements', VehicleTirePlacementViewSet, basename='vehicletireplacement')
router.register(r'maintenance-logs', MaintenanceLogViewSet, basename='maintenancelog')
router.register(r'oil-changes', OilChangeLogViewSet, basename='oilchangelog')
router.register(r'maintenance-alerts', MaintenanceAlertViewSet, basename='maintenancealert')

urlpatterns = [
    path('', include(router.urls)),
]
