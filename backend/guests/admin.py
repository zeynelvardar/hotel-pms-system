from django.contrib import admin
from .models import Guest

@admin.register(Guest)
class GuestAdmin(admin.ModelAdmin):
    list_display = ("first_name", "last_name", "tc_no", "passport_no", "birth_date", "is_main_guest")
    list_filter = ("is_main_guest", "created_at")
    search_fields = ("first_name", "last_name", "tc_no", "passport_no", "phone", "email")