# reservations/migrations/0002_enable_btree_gist.py
from django.contrib.postgres.operations import BtreeGistExtension
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('reservations', '0001_initial'),
    ]

    operations = [
        BtreeGistExtension(),
    ]