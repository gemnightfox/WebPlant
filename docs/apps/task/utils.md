## get_task_or_404
1. Gets the task object
2. If no object found (ID not found), raises 404 error
3. If user is not allowed to access task (eg. user not inside workspace), raise 404 error
4. If nothing goes wrong, return the task object



## duplicate_task_only
- Used to duplicate a task object, as well as duplicating and bringing over linked TaskAttachment objects




