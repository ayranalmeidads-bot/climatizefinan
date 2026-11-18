/* Climatize 2.3.4: recuperação independente, sem carregar dashboard ou módulos financeiros. */
(() => {
  'use strict';
  const AUTH_URL = 'https://ditkzuoqdgxkziwjkege.supabase.co';
  const AUTH_KEY = 'sb_publishable_XRwRbPVyeDggyeYcbA0fQQ_ImSkKoi6';
  const byId = (id) => document.getElementById(id);
  const originalURL = new URL(window.location.href);
  const params = originalURL.searchParams;
  const fragment = new URLSearchParams(originalURL.hash.replace(/^#/, ''));
  const proof = {
    accessToken: fragment.get('access_token'),
    code: params.get('code'),
    tokenHash: params.get('token_hash'),
    type: fragment.get('type') || params.get('type') || '',
    error: params.get('error') || fragment.get('error') || params.get('error_code') || fragment.get('error_code'),
    errorDescription: params.get('error_description') || fragment.get('error_description') || ''
  };
  const hasCredential = Boolean(proof.accessToken || proof.code || proof.tokenHash);
  let auth = null;
  let trustedRecoveryEvent = false;
  let authorized = false;

  function show(view) {
    ['reset-validating', 'reset-password-form', 'reset-result'].forEach(id => {
      byId(id).classList.toggle('active', id === view);
    });
  }
  function result(title, message, success = false) {
    byId('reset-result-title').textContent = title;
    const text = byId('reset-result-message');
    text.textContent = message;
    text.classList.toggle('is-success', success);
    text.classList.toggle('is-error', !success);
    byId('reset-login-link').href = success ? './index.html?auth_reset=success' : './index.html';
    show('reset-result');
  }
  function feedback(msg) {
    const field = byId('reset-feedback');
    field.textContent = msg;
    field.classList.remove('hidden');
    field.classList.add('auth-error');
  }
  function clearSensitiveURL() {
    // Remove tokens/codes from URL without reloading or losing the validated session.
    try { const clean = new URL(window.location.href); clean.search = ''; clean.hash = ''; window.history.replaceState(null, '', clean.href); } catch(e) {}
  }
  const invalidLink = 'Este link de recuperação não pôde ser validado ou expirou. Volte ao login, toque em “Esqueci minha senha” e solicite um novo e-mail.';

  async function validate() {
    if (proof.error) {
      clearSensitiveURL();
      return result('Link expirado ou inválido', invalidLink);
    }
    // Mere open redirect or preexisting session is NOT sufficient to reset an account.
    if (!hasCredential || (proof.type && proof.type !== 'recovery')) {
      return result('Link de recuperação necessário', invalidLink);
    }
    if (!window.supabase?.createClient) {
      return result('Serviço indisponível', 'Não foi possível carregar a autenticação. Verifique sua conexão com a internet e abra o link novamente.');
    }
    try {
      auth = window.supabase.createClient(AUTH_URL, AUTH_KEY, {
        auth: { detectSessionInUrl: !proof.code, persistSession: true, autoRefreshToken: true }
      }).auth;
      auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') trustedRecoveryEvent = true;
      });
      let verifiedSession = null;
      if (proof.tokenHash) {
        const { data, error } = await auth.verifyOtp({token_hash: proof.tokenHash, type: 'recovery'});
        if (error) throw error;
        verifiedSession = data?.session || null;
      } else if (proof.accessToken) {
        // Supabase processes #access_token automatically; require the token received in the link.
        const { data, error } = await auth.getSession();
        if (error) throw error;
        if (data?.session?.access_token === proof.accessToken && proof.type === 'recovery') {
          verifiedSession = data.session;
        } else if (trustedRecoveryEvent && data?.session) {
          verifiedSession = data.session;
        }
      } else if (proof.code) {
        // PKCE fallback: Supabase may exchange the code automatically during initialization.
        const {data} = await auth.getSession();
        if (trustedRecoveryEvent && data?.session) verifiedSession = data.session;
        if (!verifiedSession) {
          const {data: exchanged, error} = await auth.exchangeCodeForSession(proof.code);
          if (error) throw error;
          verifiedSession = exchanged?.session || null;
        }
      }
      if (!verifiedSession?.access_token) throw new Error('A sessão de recuperação não foi estabelecida.');
      const {data: userData, error: userError} = await auth.getUser();
      if (userError || !userData?.user) throw (userError || new Error('Não foi possível validar o usuário.'));
      authorized = true;
      clearSensitiveURL();
      show('reset-password-form');
      byId('reset-password-one').focus();
    } catch (error) {
      console.warn('Climatize: link de recuperação não validado:', error?.message);
      clearSensitiveURL();
      result('Não foi possível validar o link', invalidLink);
    }
  }

  byId('reset-password-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!authorized || !auth) return feedback('A recuperação não foi validada. Solicite um novo link.');
    const password = byId('reset-password-one').value;
    const confirm = byId('reset-password-two').value;
    if (password.length < 8) return feedback('A senha deve ter pelo menos 8 caracteres.');
    if (password !== confirm) return feedback('As senhas digitadas não coincidem.');
    const button = byId('reset-confirm');
    button.disabled = true;
    byId('reset-feedback').classList.add('hidden');
    try {
      const {error} = await auth.updateUser({password});
      if (error) throw error;
      authorized = false;
      byId('reset-password-one').value = '';
      byId('reset-password-two').value = '';
      const {error: signOutError} = await auth.signOut({scope:'local'});
      if (signOutError) throw new Error('Senha alterada, mas não foi possível encerrar a sessão automaticamente.');
      result('Senha alterada com sucesso!', 'Sua nova senha foi salva. Volte ao login e entre com seu e-mail e a senha que acabou de criar.', true);
    } catch (error) {
      console.warn('Climatize: falha ao salvar nova senha:', error?.message);
      if (!authorized) result('Senha atualizada', 'A senha foi atualizada, mas não foi possível encerrar a sessão. Feche o aplicativo e abra o login para entrar com a nova senha.', true);
      else feedback('Não foi possível salvar a nova senha. Verifique os requisitos de segurança e tente novamente.');
    } finally { button.disabled = false; }
  });
  validate();
})();
