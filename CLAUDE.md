# monitor-eduardo-gomes — Guia do Agente Claude Code

## O que e este projeto
Dashboard React de inteligencia eleitoral para a campanha de reeleicao do
Senador Eduardo Gomes (PL-TO). Protegido por autenticacao Supabase.
Dados lidos de JSONs publicos neste mesmo repositorio (GitHub raw).

## Estado atual
- [ ] npm init + vite configurado
- [ ] src/lib/supabase.js criado
- [ ] src/App.jsx completo com 7 modulos
- [ ] Deploy Vercel configurado

## Paleta (CSS variables no :root)
--primary:    #1A2F5A   azul institucional (fundo header, sidebar ativa)
--accent:     #C8A951   dourado (destaques, CTAs, badges)
--success:    #2D7A4F   verde (positivo, alta prioridade)
--danger:     #C0392B   vermelho (crise, rejeicao, ALTA ameaca)
--warning:    #D4700A   laranja (alertas, Alexandre Guimaraes)
--bg:         #F0F2F7   fundo da pagina
--surface:    #FFFFFF   cards e paineis
--text:       #1A1A2E   texto principal
--text-muted: #6B7280   texto secundario

## Tipografia
Display / titulos:  Playfair Display  (400, 600, 700)
Interface / corpo:  Inter             (400, 500, 600)
Importar via <link> do Google Fonts no index.html

## URL base dos dados (fetch nos useEffects)
https://raw.githubusercontent.com/salescampelo/monitor-eduardo-gomes/main/data/

## Variaveis de ambiente (prefixo VITE_ obrigatorio no Vite)
VITE_SUPABASE_URL         -> URL do projeto Supabase
VITE_SUPABASE_ANON_KEY    -> chave anon publica
VITE_GITHUB_DATA_BASE_URL -> URL base acima

## 7 Modulos — descricao resumida
M1 Monitor de Imprensa     -> feed mencoes com filtros cluster/relevancia/periodo
M2 Redes Sociais           -> metricas Instagram aliados + adversarios + sentimento
M3 Inteligencia Municipal  -> 139 municipios TO com score e card de detalhe
M4 Inteligencia Competitiva-> ranking SAD adversarios com alerta Alexandre Guimaraes
M5 KPIs de Campanha        -> 8 indicadores + countdown para 4 out 2026
M6 Briefing Diario         -> conteudo do ultimo briefing + botao download PDF
M7 Radar de Entregas       -> R 2bi em emendas por municipio e categoria

## Cores dos badges de cluster (M1)
DIRECT        -> var(--primary)   #1A2F5A
CRISIS        -> var(--danger)    #C0392B
ELECTORAL     -> #7B2D8B  roxo
INSTITUTIONAL -> var(--success)   #2D7A4F
ALLIANCE      -> var(--text-muted)#6B7280
COMPETITIVE   -> var(--warning)   #D4700A

## Convencoes de design
Cards:  border-radius 12px | box-shadow 0 2px 8px rgba(0,0,0,0.08) | padding 20px
Hover:  transform translateY(-2px) | transition 0.2s ease
Modulos: header clicavel minimiza o painel (chevron icon Lucide)
Header: sticky | fundo --primary | logo branco | botao logout direita
Mobile: sidebar vira bottom navigation com icones

## Autenticacao Supabase
1. supabase.auth.signInWithPassword({email, password})
2. Apos login: SELECT email FROM allowed_users WHERE email = user.email
3. Se nao encontrado: exibir tela acesso negado com botao logout
4. Estado global: session (null = nao logado, objeto = logado)

## Regra especial M4
Alexandre Guimaraes (MDB) sempre exibe badge laranja "Atencao: candidato renovacao"
independente do nivel de SAD calculado. Campo "alerta": "candidato_renovacao" no JSON.