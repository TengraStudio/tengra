import { Notification } from 'electron';

const NOTIFICATION_MESSAGE_KEY = {
    NOT_SUPPORTED: 'mainProcess.notificationService.notSupported'
} as const;
const NOTIFICATION_ERROR_MESSAGE = {
    NOT_SUPPORTED: 'Notifications not supported'
} as const;

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
        return {
            success: false,
            error: NOTIFICATION_ERROR_MESSAGE.NOT_SUPPORTED,
            messageKey: NOTIFICATION_MESSAGE_KEY.NOT_SUPPORTED
        };
    }
}
