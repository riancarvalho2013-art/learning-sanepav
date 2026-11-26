# Learning Academy — Biblioteca ampliada de componentes

Preserva a biblioteca anterior: 1520 recortes de 33 origens. Acrescenta 691 recortes e 12 origens. Total: 2211 recortes registrados.

## Novos conteúdos
- `08-perfis-acesso`: Colaborador (3 variantes), Líder, RH/DHO e Administrador, em concepts individuais; Diretoria: recorte da prancha de cinco perfis, não concept independente em alta resolução.
- `09-pranchas-complementares`: pranchas e regiões de módulos, incluindo abas antes faltantes. A prancha `perfis-nao-oficiais` apresenta papéis não existentes no código; não implementar seus acessos.
- `GALERIA-NOVOS-PERFIS.html`: navegação dos novos recortes. `GALERIA.html` continua sendo a galeria anterior. Manifestos CSV/JSON unificados.

## Aplicação no Git
Esta biblioteca não altera a plataforma. Guarde como referência em `design-reference/` se desejar versioná-la. Para implantação futura prefira o ZIP menor de assets, que contém somente fundos, logos e SVGs. Nenhum arquivo deve substituir `web-app.js`, `web-style.css`, manifesto ou endpoints nesta fase. Imagens com textos, nomes, métricas e rostos são referências; reconstruir os componentes funcionais com dados reais. Não usar as imagens como botões.

## Perfis reais
Colaborador, Líder, RH/DHO, Diretoria e Administrador (verificados no código na conversa). A navegação e ações devem ser derivadas das permissões reais, incluindo escopo empresarial/hierárquico; a UI não concede permissão. Diretoria: indicadores agregados autorizados; não expor feedback privado ou respostas protegidas. Não inventar métricas de ROI, risco de turnover, disponibilidade, saúde do servidor ou integrações.

## Lacunas
As abas representadas somente em pranchas não têm concept independente de alta resolução: 1:1, Elogio, Pulse, Desempenho, Intranet, Rede social, Perfil, Organização, 9Box, Certificados, Caderno de notas, Minha jornada, Academia de práticas, Meu acesso, Descobertas LXP, Pulse Seguro, Avaliações educacionais, Eficácia, Evolução da plataforma e outras telas administrativas. Os recortes regionais e subcomponentes dessas miniaturas são aproximados. Também faltam referências individuais de vários estados, formulários e pop-ups. Não declarar cobertura visual completa ou código homologado.
