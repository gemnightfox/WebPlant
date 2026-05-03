## send_email
- If argument `save_to_db=False`, online emails are sent without saving a Notification object (eg. Email verification, Account password reset)
- Online email is only sent when: `notification.models.NotificationDisabledDuration` is not active, AND `accounts.models.UserPreference.can_receive_notifications=True`. Check **notification.utils.send_email.can_receive_notifications** (nested function) for more information.
- Ratelimits blocks sending too much messages to an email
- Read **docs/apps/notification/models.md** for more information



## generate_temporary_disable_notifications_link
- Generates a link with a token (no login required), ready to be sent via email
- Extends from base_utils.CustomTokenGenerator (read **docs/apps/base_utils.md** for more information)



## save_temp_disabled_duration
- Receives a duration (hours), calculates the ending time (timer), and updates the notification.models.NotificationDisabledDuration
    - If no object yet, create one with the given ending time
    - If object present, only keeps the one with the furthest ending date (lasts the longest)
- Read **docs/apps/notification/** for more information




