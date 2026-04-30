## get_group_or_404
1. Gets the group object
2. If no object found (ID not found), raises 404 error
3. If user is not allowed to access group (eg. user not inside workspace), raise 404 error
4. If nothing goes wrong, return the group object



## duplicate_group_only
- Used to duplicate a group object (does not carry over tasks, done by task.utils.duplicate_task_only)




