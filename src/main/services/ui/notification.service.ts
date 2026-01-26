import { Notification } from 'electron';

export class NotificationService {
    showNotification(title: string, body: string, silent: boolean = false) {
        if (Notification.isSupported()) {
            const notification = new Notification({
                title,
                body,
                silent
            });
            notification.show();
            return { success: true };
        }
        return { success: false, error: 'Notifications not supported' };
    }
}
