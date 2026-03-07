from django.urls import path

from .assistant_views import AssistantParseView, AssistantExecuteView

urlpatterns = [
    path('parse/', AssistantParseView.as_view(), name='assistant-parse'),
    path('execute/', AssistantExecuteView.as_view(), name='assistant-execute'),
]
