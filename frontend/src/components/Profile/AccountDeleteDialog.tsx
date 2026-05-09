import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface AccountDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (password: string) => void;
}

export function AccountDeleteDialog({ isOpen, onClose, onSubmit }: AccountDeleteDialogProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1: warning, 2: confirmation

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (step === 1) {
      if (confirmText !== 'DELETE') {
        setError(t('pleaseTypeDelete'));
        return;
      }
      setStep(2);
      return;
    }

    if (!password) {
      setError(t('passwordRequired'));
      return;
    }

    if (confirmText !== 'DELETE MY ACCOUNT') {
      setError(t('pleaseTypeDeleteMyAccount'));
      return;
    }

    onSubmit(password);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center mb-4">
          <Trash2 className="h-5 w-5 mr-2 text-red-600" />
          <h3 className="text-lg font-semibold text-red-600">{t('deleteAccountTitle')}</h3>
        </div>

        {step === 1 && (
          <>
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t('deleteAccountWarning')}
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('typeDeleteToContinue')}
              </p>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={t('typeDelete')}
                className="text-center"
              />
              {error && (
                <div className="text-sm text-red-500">{error}</div>
              )}
              <div className="flex space-x-2">
                <Button
                  onClick={handleSubmit}
                  variant="destructive"
                  className="flex-1"
                  disabled={confirmText !== 'DELETE'}
                >
                  {t('continue')}
                </Button>
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                >
                  {t('cancel')}
                </Button>
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t('finalConfirmation')}
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="password">{t('enterPassword')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('enterPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">{t('typeDeleteMyAccount')}</Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE MY ACCOUNT"
                className="text-center"
              />
            </div>

            {error && (
              <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                {error}
              </div>
            )}

            <div className="flex space-x-2">
              <Button
                type="submit"
                variant="destructive"
                className="flex-1"
                disabled={!password || confirmText !== 'DELETE MY ACCOUNT'}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t('deleteAccount')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep(1);
                  setConfirmText('');
                }}
                className="flex-1"
              >
                {t('back')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                {t('cancel')}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
