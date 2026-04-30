## Notification
- Stores notifications sent to users
- Email-only notifications (eg. Email verification, Account password reset) is not saved as a Notification object
- If accounts.models.UserPreference.can_receive_notifications=False, the server will save Notification objects, WITHOUT sending online emails to the receiver/user (applies for **NotificationDisabledDuration** section found below as well)
- Sent via notification.utils.send_email (read **docs/apps/notification/utils.md** for more information)



## NotificationDisabledDuration
- Used to temporarily disable emails for a selected amount of time (acts like accounts.models.UserPreference.can_receive_notifications=False, until timer runs out)
    - Note: accounts.models.UserPreference.can_receive_notifications=False will permanently disable email until set to True again, while NotificationDisabledDuration will automatically enable emails when timer runs out



