import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, AuthResponse } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { HttpErrorResponse } from '@angular/common/http';
import { validarEmail } from '../shared/utils/validators';

export type Role = 'CARTORIO' | 'ADVOGADO' | 'CLIENTE' | 'COLABORADOR';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.scss'],
})
export class LoginComponent {
  private toastService = inject(ToastService);

  isLoading    = false;
  isSendingLink = false;
  errorMessage: string | null = null;

  loginForm = { email: '', password: '' };
  formErrors: Record<string, string> = {};
  showPassword = false;
  readonly anoAtual = new Date().getFullYear();

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  hasError(field: string): boolean { return !!this.formErrors[field]; }
  getError(field: string): string  { return this.formErrors[field]; }

  onSubmit(): void {
    this.formErrors  = {};
    this.errorMessage = null;

    const erroEmail = validarEmail(this.loginForm.email);
    if (erroEmail)               this.formErrors['email']    = erroEmail;
    if (!this.loginForm.password) this.formErrors['password'] = 'Senha e obrigatoria';
    if (Object.keys(this.formErrors).length) {
      Object.values(this.formErrors).forEach(msg => this.toastService.error(msg));
      return;
    }

    this.isLoading = true;

    this.authService.login(
      this.loginForm.email,
      this.loginForm.password,
    ).subscribe({
      next: (response: AuthResponse) => {
        this.isLoading = false;
        this.handleLoginSuccess(response);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading    = false;
        this.errorMessage = this.traduzirErroLogin(err);
      },
    });
  }

  private handleLoginSuccess(response: AuthResponse): void {
    if (response.context_required) {
      this.authService.guardarVinculosPendentes(
        response.user_id,
        response.nome,
        response.vinculos_disponiveis ?? [],
      );
      this.router.navigate(['/selecionar-contexto']);
      return;
    }
    this.redirecionarPorRole(response.role ?? '');
  }

  private redirecionarPorRole(role: string): void {
    const rotas: Record<string, string> = {
      MASTER:          '/dashboard',
      GESTOR:          '/dashboard',
      TABELIAO:        '/dashboard',
      LIDER_EQUIPE:    '/dashboard',
      ESCREVENTE:      '/dashboard',
      AUX_ESCREVENTE:  '/dashboard',
      ESTAGIARIO:      '/dashboard',
    };
    this.router.navigate([rotas[role] ?? '/dashboard']);
  }

  irParaReset():    void { this.router.navigate(['/forgot-password']); }
  irParaCadastro(): void { this.router.navigate(['/cadastro']); }

  onSendMagicLink(): void {
    if (this.isSendingLink) return;

    this.formErrors  = {};
    this.errorMessage = null;

    const erroEmail = validarEmail(this.loginForm.email);
    if (erroEmail) {
      this.formErrors['email'] = erroEmail;
      this.toastService.error(erroEmail);
      return;
    }

    this.isSendingLink = true;
    this.authService.requestMagicLink(this.loginForm.email).subscribe({
      next: () => {
        this.isSendingLink = false;
        this.toastService.success(
          'Se o e-mail estiver cadastrado, você receberá um link de acesso em instantes. O link expira em 10 minutos.',
        );
      },
      error: (err: HttpErrorResponse) => {
        this.isSendingLink = false;
        if (err.status === 429) {
          this.toastService.warning('Muitas tentativas. Aguarde alguns minutos.');
        } else {
          this.toastService.error('Não foi possível enviar o link. Tente novamente.');
        }
      },
    });
  }

  private traduzirErroLogin(err: HttpErrorResponse): string {
    let mensagens: string[];
    let tipo: 'error' | 'warning' = 'error';

    if (err.status === 0) {
      mensagens = ['Sem conexão com o servidor. Verifique sua internet.'];
    } else if (err.status === 401) {
      const detail = err?.error?.detail;
      mensagens = Array.isArray(detail) ? detail : [detail || 'Credenciais inválidas.'];
    } else if (err.status === 403) {
      const detail = err?.error?.detail;
      mensagens = Array.isArray(detail) ? detail : [detail || 'Acesso negado. Entre em contato com o administrador.'];
      tipo = 'warning';
    } else if (err.status === 409) {
      const detail = err?.error?.detail;
      mensagens = Array.isArray(detail) ? detail : [detail || 'Este usuário já está conectado em outro dispositivo.'];
      tipo = 'warning';
    } else if (err.status === 429) {
      mensagens = ['Muitas tentativas. Aguarde alguns segundos.'];
    } else if (err.status >= 500) {
      mensagens = ['Erro no servidor. Tente novamente em instantes.'];
    } else {
      mensagens = ['Não foi possível realizar o login. Tente novamente.'];
    }

    mensagens.forEach(msg => this.toastService[tipo](msg));
    return mensagens.join(' | ');
  }
}
