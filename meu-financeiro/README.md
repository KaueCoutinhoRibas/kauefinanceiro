# Meu Financeiro

Aplicativo web pessoal para acompanhar o saldo real em conta, recebimentos futuros, contas pendentes, gastos de rotina e dinheiro realmente guardado.

## Como entender a previsão de dinheiro livre

A página inicial apresenta duas informações diferentes:

- **Saldo atual no banco:** o valor que existe na conta neste momento. Pode ser corrigido pelo botão de edição.
- **Previsão de dinheiro livre na conta:** o valor estimado que deve sobrar depois que os recebimentos entrarem, as contas forem pagas, a rotina do mês acontecer e a reserva for separada.

A previsão é calculada assim:

```text
Saldo atual no banco
+ salário que ainda vai entrar
+ valores que pessoas ainda vão pagar
- contas pendentes (incluindo a fatura do cartão)
- gastos de rotina que ainda faltam (cabelo, comunitário e IFTO)
- valor que ainda falta separar para a reserva
= previsão de dinheiro livre na conta
```

O valor mensal que você pretende guardar pode ser ajustado em **“Ajustar quanto vou guardar”** no painel. Por padrão, a meta mensal é R$ 300,00. Depósitos feitos na reserva durante o mês já contam para essa meta, para não serem descontados novamente.

Quando você marca salário como recebido, conta como paga, registra uma refeição ou guarda dinheiro, o saldo real muda e a previsão se recalcula. A ideia é que uma mesma movimentação não seja descontada duas vezes.

## Executar no computador

1. Instale Node.js 18 ou superior.
2. Abra esta pasta no VS Code.
3. Abra o terminal e execute `npm install` (somente na primeira vez).
4. Execute `npm run dev` para abrir o site localmente.
5. Para gerar os arquivos prontos para publicação, execute `npm run build`.

## Publicar gratuitamente no GitHub Pages

O projeto já está configurado para publicação em um repositório GitHub usando GitHub Actions.

1. Envie todos os arquivos desta pasta para a branch `main` de um repositório GitHub.
2. No repositório, entre em **Settings → Pages**.
3. Em **Build and deployment**, selecione **GitHub Actions** como fonte.
4. Acesse **Actions** e aguarde o fluxo “Publicar Meu Financeiro no GitHub Pages” concluir.
5. O endereço do site aparecerá em **Settings → Pages**.

O workflow recompila e republica o site a cada atualização enviada para `main`.

## Instalar no celular (PWA)

Depois da publicação em HTTPS:

- **Android/Chrome:** abra o link do site, toque no menu do navegador e escolha “Instalar app” ou “Adicionar à tela inicial”.
- **iPhone/Safari:** abra o site, toque em Compartilhar e escolha “Adicionar à Tela de Início”.

O PWA abre em uma janela própria e pode reutilizar os arquivos já carregados quando estiver offline. A primeira visita e a instalação precisam de internet.

## Dados, privacidade e sincronização

- Não há login nem conta: o site abre diretamente.
- Os registros ficam no `localStorage` do navegador e dispositivo em que foram cadastrados.
- Sem banco de dados na nuvem, os dados do celular e do computador **não sincronizam entre si**.
- Use o recurso de backup para exportar um arquivo JSON e importar para outro navegador/dispositivo.
- Faça backups antes de limpar os dados do navegador ou trocar de aparelho.

## Como o cartão é tratado

As despesas marcadas como incluídas na fatura aparecem na distribuição por categoria, mas não descontam dinheiro da conta individualmente. O pagamento sai uma única vez quando a fatura do cartão é marcada como paga. Despesas pagas diretamente por Pix/débito mantêm seu próprio controle.

## Dados financeiros iniciais

- Salário calculado: R$ 2.166,80.
- Planejamento conservador: R$ 2.116,80.
- Parcela de 40%: R$ 866,72.
- Parcela conservadora de 60%: R$ 1.250,08.
- Saldo inicial de conta para uma instalação nova: R$ 679,00.
- Fatura inicial do cartão: R$ 1.478,00.
- Orçamento inicial de rotina: cabelo R$ 80,00, restaurante comunitário R$ 60,00 e IFTO R$ 140,00.
- Meta mensal inicial para separar na reserva: R$ 300,00.

Os valores são editáveis. A fatura é configurada por mês: o valor inicial de R$ 1.478,00 é migrado para o mês atual, mas os meses futuros começam sem valor até você preencher a fatura correspondente. Em uma instalação que já tenha dados salvos, a atualização preserva o saldo existente e os registros do navegador.
