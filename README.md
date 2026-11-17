# 🚀 PROJECT TYCOON — Simulador de Gestão de Software House

[![Status](https://img.shields.io/badge/Status-EM%20DESENVOLVIMENTO-yellow?style=for-the-badge&logo=git)](https://github.com/PedroLssouza/jogo_tycoon)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

> ⚠️ **AVISO: PROJETO EM DESENVOLVIMENTO ATIVO (WIP)**  
> Este jogo está em fase de concepção e desenvolvimento de suas mecânicas centrais. Novas funcionalidades, balanceamento e melhorias visuais estão sendo implementadas continuamente de acordo com o roadmap definido.

---

## 🎮 Sobre o Jogo

**PROJECT TYCOON** é um simulador de estratégia e gerenciamento empresarial focado no universo de empresas de desenvolvimento de software (Software Houses).

O jogador assume o papel do fundador de uma startup de tecnologia em estágio inicial com uma pequena quantia em caixa e uma equipe enxuta. O grande desafio é transformar essa pequena operação em uma das maiores e mais respeitadas potências de tecnologia do mercado global.

O diferencial do **PROJECT TYCOON** é fugir de simples dashboards numéricos ou protótipos decorativos: trata-se de um jogo com **mecânicas reais e integradas**, economia dinâmica, progressão palpável e consequências diretas para cada decisão tomada.

---

## 🏛️ Os 5 Pilares Fundamentais

Todas as decisões tomadas pelo jogador impactam diretamente a empresa através de 5 pilares interconectados:

```
                  ┌────────────────────────┐
                  │    1. ESTRATÉGIA       │
                  │ Posicionamento & Foco  │
                  └───────────┬────────────┘
                              │
     ┌────────────────────────┼────────────────────────┐
     ▼                        ▼                        ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ 2. PROJETOS  │      │  3. PESSOAS  │      │ 4. FINANÇAS  │
│ Kanban &     │      │ Recrutamento │      │ Fluxo de     │
│ Entregas     │      │ & Retenção   │      │ Caixa & Burn │
└──────────────┘      └──────────────┘      └──────────────┘
                              │
                              ▼
                  ┌────────────────────────┐
                  │      5. QUALIDADE      │
                  │ Reputação & Excelência │
                  └────────────────────────┘
```

1. **Estratégia:** Escolha de nichos de mercado, ritmo de crescimento e planejamento a médio/longo prazo.
2. **Projetos:** Gestão de backlog, fluxo de tarefas no Kanban, estimativas e cumprimento rígido de prazos.
3. **Pessoas:** Recrutamento de talentos, motivação, gestão de energia/burnout, salários e especializações.
4. **Finanças:** Controle do fluxo de caixa, despesas operacionais, pagamentos de salários e risco de falência.
5. **Qualidade:** Prevenção de débitos técnicos e bugs, satisfação do cliente e consolidação da reputação.

---

## 🖥️ Estilo Visual & Identidade

- **Pixel Art Moderna & UI Tech:** Combinação de elementos em pixel art sofisticada com interfaces modernas no estilo cyberpunk e tech corporate.
- **Paleta de Cores Sofisticada:** Predominância de tons escuros (`#0b0e1a`, `#131826`), roxo neon (`#8b5cf6`), azul tech (`#6c8cff`) e detalhes em verde esmeralda (`#22c55e`).
- **Animações e Transições:** Transições fluidas entre abas, barras de progresso reais com feedback visual e notificações em tempo real.
- **Responsividade Computador-First:** Ergonomia pensada para telas de desktop, priorizando a visualização de dados sem sobrecarregar a experiência de jogo.

---

## 🕹️ Funcionalidades e Sistemas Detalhados

### 1. Menu Principal & Configuração de Partida
- **Telas:** Nova Partida, Continuar, Configurações de Áudio/Interface e Créditos.
- **Criação de Empresa:**
  - Definição do nome da empresa e nome do fundador.
  - Seleção de dificuldade:
    - **Fácil:** Maior capital inicial, clientes mais tolerantes a atrasos e menor custo operacional.
    - **Normal:** Economia balanceada, margem realista para erros.
    - **Difícil:** Menor reserva de caixa, penalidades severas e clientes mais exigentes.
- **Persistência:** Sistema completo de salvamento automático e carregamento via `localStorage`.

### 2. Escritório — Centro de Controle
O escritório é o hub central de operação, exibindo em tempo real:
- **Painel de Indicadores (HUD):**
  - Saldo bancário atualizado e lucro líquido.
  - Receitas vs. Despesas do período.
  - Burn rate semanal e projeção financeira.
  - Reputação de mercado (0 a 100).
  - Número de colaboradores ativos e dias restantes para entregas críticas.
- **Navegação por Módulos:**
  - 📊 **Visão Geral:** Dashboard com métricas consolidadas e alertas urgentes.
  - 📋 **Projetos:** Kanban interativo e status das demandas.
  - 👥 **Funcionários:** Gestão de equipe, contratações e detalhes individuais.
  - 💼 **Clientes & Contratos:** Negociação e aceite de novos contratos.
  - 💰 **Financeiro:** Extrato detalhado e previsões de fluxo de caixa.
  - 🏢 **Melhorias & Expansão:** Compra de maquinário, upgrades de sede e tecnologias.
  - ⚙️ **Configurações:** Opções gerais e gerenciamento do save.
- **Evolução Visual:** O escritório físico evolui conforme a empresa sobe de patamar (de uma garagem/quarto até um andar corporativo em arranha-céu).

### 3. Sistema de Contratos e Clientes
- **Geração Procedural de Contratos:**
  - Nome do cliente e escopo do projeto (ex.: E-commerce escalável, Sistema Bancário, MVP de Delivery).
  - Valor bruto do contrato e custo estimado.
  - Prazo de entrega (dias corridos).
  - Quantidade de features e nível de complexidade (Fácil, Médio, Complexo).
  - Requisitos técnicos (linguagens, frameworks, banco de dados e infraestrutura).
  - Penalidades diárias por atraso e bônus generosos por entregas antecipadas ou com padrão de qualidade superior.
- **Reputação Dinâmica:** Clientes premium e contratos milionários internacionais só são liberados para empresas com alta reputação.

### 4. Gestão de Funcionários & Equipes
Cada membro da equipe possui personalidade, especializações e estatísticas dinâmicas:
- **Atributos:**
  - Produtividade base (velocidade de entrega).
  - Velocidade de raciocínio / codificação.
  - Qualidade técnica (probabilidade de gerar código limpo vs. bugs).
  - Satisfação (0 a 100%) e Energia (necessidade de pausas e descanso).
  - Estado atual: *Ocioso*, *Trabalhando*, *Exausto*, *Doente*, *Insatisfeito*, *Buscando novo emprego*.
- **Cargos Especializados:**
  - 🎨 **Designer UI/UX:** Essencial para wireframes, protótipos e satisfação visual.
  - 💻 **Desenvolvedor Front-end:** Construção de interfaces e usabilidade.
  - ⚙️ **Desenvolvedor Back-end:** Regras de negócio, APIs e consistência de dados.
  - 🌐 **Desenvolvedor Full Stack:** Versatilidade para cobrir gargalos.
  - 🧪 **Analista de QA:** Caçador de bugs antes da entrega ao cliente.
  - 📈 **Gerente de Projetos (PM):** Mitigação de atrasos e otimização de sprints.
  - 🚀 **DevOps:** Infraestrutura, estabilidade de servidores e automação de deploy.
- **Ações de Gestão:** Contratar, demitir, promover cargos, ajustar salários, conceder bônus e realocar tarefas. Cuidado com o **Burnout**: funcionários sobrecarregados cometem erros graves e podem pedir demissão.

### 5. Quadro Kanban & Execução de Tarefas
- Quadro Kanban dividido em:
  - 📌 **A Fazer (Backlog):** Tarefas priorizadas que aguardam início.
  - ⚡ **Em Andamento:** Tarefas com colaboradores ativamente alocados.
  - 🔍 **Validação / Testes (QA):** Verificação de bugs e refatoração.
  - ✅ **Concluído:** Funcionalidades finalizadas e prontas para entrega.
- **Progresso Real por Tempo:**
  - O progresso de cada tarefa é calculado matematicamente considerando a complexidade da demanda vs. o rendimento diário do desenvolvedor atribuído.
  - Relações de dependência entre tarefas (ex.: o Front-end depende da finalização da API do Back-end).

### 6. Sistema de Tempo & Calendário
- Controle total sobre o fluxo do tempo: **Pausar (⏸)**, **Velocidade Normal (▶ 1x)** e **Acelerar (⏩ 2x / 5x)**.
- O avanço dos dias dispara automaticamente o ciclo de:
  - Trabalho diário dos funcionários.
  - Contagem regressiva dos prazos de contratos.
  - Pagamento mensal de folha salarial e custos fixos.
  - Recuperação ou desgaste de energia da equipe.
  - Possibilidade de eventos aleatórios.

### 7. Sistema Financeiro & Economia
- **Fluxo de Caixa Vivo:** Cada centavo conta.
- **Custos Operacionais:** Aluguel do escritório, servidores em nuvem, licenças de software, contas de consumo e alimentação.
- **Risco Real de Falência:** Se o saldo bancário atingir níveis negativos crônicos e o limite de crédito for esgotado, a empresa fecha as portas (Game Over).
- **Relatórios Gerenciais:** Apuração de DRE básica, com receitas auferidas, custos diretos dos projetos e lucro operacional.

### 8. Qualidade, Entrega e Resultados
Ao concluir um projeto, o jogo calcula a performance geral:
- Prazos cumpridos ou estourados.
- Qualidade técnica do código e índice de bugs remanescentes.
- Satisfação do cliente (escala de 1 a 5 estrelas).
- Variação líquida de reputação.
- Liberação de novos clientes com base no sucesso obtido.

### 9. Progressão e Expansão
- **Upgrades de Escritório:** Garagem ➔ Escritório Compartilhado (Coworking) ➔ Sede Própria ➔ Andar Corporativo em Centro Tecnológico.
- **Infraestrutura:** Compra de cadeiras ergonômicas, monitores duplos, servidores dedicados, cafeteria gourmet e salas de descanso.
- **Novos Mercados:** Atendimento a multinacionais e projetos governamentais.

### 10. Eventos Aleatórios & Tomada de Decisão
Durante a rotina, o jogador se depara com dilemas reais que exigem escolhas estratégicas:
- Um desenvolvedor sênior recebe uma proposta irrecusável do exterior (cobrir a oferta ou deixá-lo ir?).
- Queda crítica nos servidores de produção na véspera de uma entrega.
- O cliente pede mudanças no escopo no meio do projeto sem pagar adicional (*scope creep*).
- Surto de gripe ou burnout generalizado na equipe antes de um prazo importante.

---

## 🛠️ Tecnologias Utilizadas

O ecossistema do projeto foi estruturado com foco em performance, tipagem estrita e arquitetura escalável:

| Tecnologia | Descrição |
|---|---|
| **[React 18+](https://react.dev/)** | Biblioteca para construção da interface baseada em componentes reutilizáveis. |
| **[TypeScript 5+](https://www.typescriptlang.org/)** | Tipagem estática garantindo consistência nos dados e sistemas do jogo. |
| **[Vite](https://vitejs.dev/)** | Bundler ultra rápido para compilação e Hot Module Replacement (HMR). |
| **[Tailwind CSS](https://tailwindcss.com/)** | Framework de estilização utilitário para design responsivo e customizado. |
| **[Zustand](https://github.com/pmndrs/zustand)** | Gerenciamento de estado global desacoplado e de alta performance. |
| **LocalStorage / Web Storage API** | Motor de persistência de progresso e save state do jogo. |

---

## 🗺️ Roadmap de Implementação

- [x] **Etapa 1:** Configuração da arquitetura base, definições de tipos (`src/types.ts`), geradores de funcionários e persistência.
- [ ] **Etapa 2:** Menu principal, tela de nova partida, seleção de dificuldade e carregamento de progresso.
- [ ] **Etapa 3:** Hub do Escritório (HUD, indicadores de fluxo de caixa, reputação e calendário).
- [ ] **Etapa 4:** Sistema de contratos, geração procedural de propostas e negociação com clientes.
- [ ] **Etapa 5:** Painel de Recursos Humanos (contratação, demissão, salários e gestão de fadiga).
- [ ] **Etapa 6:** Quadro Kanban interativo com distribuição de tarefas e progresso real.
- [ ] **Etapa 7:** Motor de simulação de tempo, ciclo diário/mensal e sistema financeiro integrado.
- [ ] **Etapa 8:** Motor de qualidade pós-entrega, cálculo de satisfação e recompensas de reputação.
- [ ] **Etapa 9:** Sistema de eventos aleatórios, upgrades de escritório e balanceamento econômico geral.

---

## 💻 Como Rodar o Projeto Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 18.0 ou superior recomendada)
- Gerenciador de pacotes `npm` ou `yarn` / `pnpm`

### Passo a Passo

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/PedroLssouza/jogo_tycoon.git
   cd jogo_tycoon
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

4. **Acesse no navegador:**
   Abra a URL indicada no terminal (geralmente [http://localhost:5173](http://localhost:5173)).

---

## 📄 Licença & Autoria

Desenvolvido por **[Pedro Luís dos Santos Souza](https://github.com/PedroLssouza)**.  
Distribuído sob a licença MIT. Consulte o arquivo `LICENSE` para mais detalhes.
