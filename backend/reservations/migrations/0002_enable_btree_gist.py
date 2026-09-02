from django.contrib.postgres.operations import BtreeGistExtension
from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ("reservations", "0001_initial"),
    ]

    operations = [
        BtreeGistExtension(), # PostgreSQL'de B-Tree GiST indexlemesini açar
    ]