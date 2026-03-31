# Development Workflow
[Back to README.md](../../README.md)



## Before Git Commit

```bash
.\.venv\Scripts\Activate
python manage.py makemigrations
python -m pip freeze > requirements.txt
```

- `makemigrations` — ensures any model changes are captured as migration files before committing.
- `pip freeze` — keeps `requirements.txt` in sync with the current virtual environment.
