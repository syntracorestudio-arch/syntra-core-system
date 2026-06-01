/**
 * Estado del formulario de login del panel (compartido cliente/servidor).
 * Fuera del archivo "use server": solo puede exportar funciones async.
 */
export interface PanelLoginState {
  error?: string;
}

export const initialPanelLoginState: PanelLoginState = {};
