import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Key, Shield, AlertTriangle } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface TwoFactorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  enabled: boolean;
  onToggle: () => void;
}

export function TwoFactorDialog({ isOpen, onClose, enabled, onToggle }: TwoFactorDialogProps) {
  const { t } = useTranslation();
  const handleToggle = () => {
    onToggle();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center mb-4">
          <Key className="h-5 w-5 mr-2 text-gray-600 dark:text-gray-300" />
          <h3 className="text-lg font-semibold">{t('twoFactorAuthentication')}</h3>
        </div>

        <div className="space-y-4">
          <Alert className={enabled ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200"}>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              {enabled ? (
                <>
                  <strong>{t('twoFactorEnabled')}</strong>
                </>
              ) : (
                <>
                  <strong>{t('twoFactorDisabled')}</strong>
                </>
              )}
            </AlertDescription>
          </Alert>

          {!enabled && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t('twoFactorNote')}
              </AlertDescription>
            </Alert>
          )}

          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <p>{t('when2FAEnabled')}</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>{t('needVerificationCode')}</li>
              <li>{t('accountProtected')}</li>
              <li>{t('useAuthenticatorApp')}</li>
            </ul>
          </div>

          <div className="flex space-x-2 pt-2">
            <Button
              onClick={handleToggle}
              className={enabled ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
            >
              {enabled ? t('disable2FA') : t('enable2FA')}
            </Button>
            <Button variant="outline" onClick={onClose}>
              {t('close')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
