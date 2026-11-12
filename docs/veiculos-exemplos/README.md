# Imagens de referência dos veículos

Imagens fotorealistas geradas com a ferramenta integrada imagegen para os registros existentes da frota brasileira; não são fotografias dos veículos operacionais.

- `renault-logan.jpg`: Renault Logan branco de frota brasileira.
- `van-executiva.jpg`: Mercedes Sprinter branca de passageiros.
- `ducato-carga.jpg`: Fiat Ducato branca de carga.
- `s10-svo.jpg`: Chevrolet S10 branca adaptada para transporte SVO.

Prompts: fotografia de catálogo automotivo, veículo inteiro em vista frontal de três quartos, piso e parede cinza, luz natural suave, placa sem identificação, sem pessoas, sem colagem ou ilustração. Cada prompt especificou o modelo e a adaptação acima.

JPEGs otimizados para até 1 MiB, enviados ao bucket privado `veiculos-fotos`, no caminho do ID de cada veículo existente sem foto. Fotos já existentes foram preservadas. Os novos cadastros não recebem esses anexos automaticamente: sem foto enviada, permanece a ilustração. Uma falha de consulta mostra erro com nova tentativa, em vez de ser tratada como ausência de foto.
