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
    DriverViewSet,
    PreventivePlanViewSet,
    PredictiveReadingViewSet,
    CorrectiveMaintenanceViewSet,
    SafetyChecklistViewSet,
    MaintenanceDashboardView,
)
from .report_views import TransportReportView

router = DefaultRouter()
router.register(r'drivers', DriverViewSet, basename='driver')
router.register(r'vehicles', VehicleViewSet, basename='vehicle')
router.register(r'revenues', TransportRevenueViewSet, basename='transportrevenue')
router.register(r'expenses', TransportExpenseViewSet, basename='transportexpense')
router.register(r'trips', TripViewSet, basename='trip')
router.register(r'tires', TireInventoryViewSet, basename='tireinventory')
router.register(r'tire-placements', VehicleTirePlacementViewSet, basename='vehicletireplacement')
router.register(r'maintenance-logs', MaintenanceLogViewSet, basename='maintenancelog')
router.register(r'oil-changes', OilChangeLogViewSet, basename='oilchangelog')
router.register(r'maintenance-alerts', MaintenanceAlertViewSet, basename='maintenancealert')
router.register(r'preventive-plans', PreventivePlanViewSet, basename='preventiveplan')
router.register(r'predictive-readings', PredictiveReadingViewSet, basename='predictivereading')
router.register(r'corrective-maintenances', CorrectiveMaintenanceViewSet, basename='correctivemaintenance')
router.register(r'safety-checklists', SafetyChecklistViewSet, basename='safetychecklist')

urlpatterns = [
    path('', include(router.urls)),
    path('reports/', TransportReportView.as_view(), name='transport-reports'),
    # Rota dedicada para download PDF (evita problemas com proxies/headers)
    path('reports/pdf/', TransportReportView.as_view(), name='transport-reports-pdf'),
    # Dashboard de manutenção (KPIs agregados)
    path('maintenance/dashboard/', MaintenanceDashboardView.as_view(), name='maintenance-dashboard'),
]
