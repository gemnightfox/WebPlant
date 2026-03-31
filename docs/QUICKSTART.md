# Quickstart
[Back to README.md](../README.md)



## Setup
```bash
python -m venv .venv
.\.venv\Scripts\Activate
python -m pip install -r requirements.txt
(Add DJANGO_DEBUG='True' into '.env' file)
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```



