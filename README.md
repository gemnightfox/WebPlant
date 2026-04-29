# WebPlant
WebPlant is a Django task management collaboration app for organizing tasks inside shared workspaces (can be used for solo projects as well).
Each workspace contains projects, groups, and tasks with comments, attachments, reminders, and notifications.



## Key Features
- Workspaces with user roles and invitations (invite users to join)
- Nested work structure: Workspace -> Project -> Group -> Task
- Task collaboration: Comments, Attachments, Completion status, Due dates, Reminders
- Real-time collaboration syncing (Channels + Daphne)



## Activating .venv
> This requires `python -m venv .venv` to be run first (view **Quick Start** for more information). Using the wrong cmd will result in an error (nothing breaks, no worries, just run the other command mentioned).
- Windows: `.venv\Scripts\Activate`
- MacOS/Linux: `source .venv/bin/activate`



## Quick Start
> Create an .env file and add: DJANGO_DEBUG='True'
> Note: Different Operating Systems have different ways to activate .venv (view **Activating .venv** for more information)
```bash
python -m venv .venv
.venv\Scripts\Activate
source .venv/bin/activate
python -m pip install -r requirements.txt
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```



## Documentation notes
- View docs/ folder for more information
- The instructions/ folder is not part of the code documentation (Stores guiding prompts for AI)




