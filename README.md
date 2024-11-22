# Projeto
Esse projeto permite estabelecer conexões via protocolo EtherNet/IP(EtherNet Industrial Protocol) para troca de informações com dispositivos que suportem o protocolo CIP. De inicio, ele fornece uma classe EtherNet/IP que permite abrir uma conexão TCP com o dispositivo remoto, e através dela é possível customizar a informação que vai ser enviada ao dispositivo.

Não tenho certeza ainda pois só cheguei a implementar um tipo de comunicação até o momento com um controlador CompactLogix da RockWell, mas pelas minhas pesquisas, de forma geral todos os dispositivos que suportam o protocolo CIP possuem até um certo nivel de padrão onde todos devem seguir, e depois disso vem os detalhes especificos que mudam dependendo da fabricante do CLP. Por exemplo, a forma de escrever um valor em um controlador X é diferente no controlador Y. Utilizando a classe EtherNet/IP contida no projeto, é possível customizar livremente todas as informações de um comando CIP para que ele fique compatível com o dispositivo que você deseja se comunicar.

Como citei, em Controladores tem uma classe pronta que usa o EtherNet/IP para se comunicar com um CompactLogix. Assim como eu fiz dessa forma, é possível criar outras classes para outros tipos de dispositivos usando como base o EtherNet/IP, você só precisa saber como montar o payload corretamente.

# Como usar
## EtherNet/IP
A classe do EtherNet/IP utiliza o Builder(Monta o pacote de Buffer que vai ser enviado ao dispositivo) e o Parser(Recebe o Buffer e organiza a informação sem muita dor de cabeça). 

### Estabelecendo uma conexão com um dispositivo EtherNet/IP
```javascript
import { EtherNetIPSocket } from "../EtherNetIP/EtherNetIP.js";

  // Informa os parametros de conexão com o dispositivo
    const connEthernetIP = new EtherNetIPSocket({
        conexao: {
            ip: '192.168.3.120',
            porta: 44818
        },
        isHabilitaLogs: true
    })

    // O método conectar abre a conexão TCP com o dispositivo e já tenta iniciar a solicitação de Register Session com o dispositivo.
    // O protocolo EtherNet/IP utiliza um "Session Handle", que é utilizado como uma chave que você precisa informar em
    // suas solicitações CIP para o dispositivo remoto reconhecer que você está autorizado a fazer solicitações.
    let isConectou = await connEthernetIP.conectar();

    // Verificar se conectou
    if (!isConectou.isConectou) {
        console.log(`Erro ao conectar com o dispositivo: ${isConectou.erro.descricao}`);
        return;
    }

    console.log(`Conectado com sucesso ao dispositivo. Session Handler é ${connEthernetIP.getSessionHandlerID()}`);

// A partir daqui, é possível enviar os pacotes ENIPS para o dispositivo.
```
Com a autenticação realizada, os próximos pacotes ENIPs que forem enviados pela classe já serão automaticamente configurados com o Session Handler

### Enviando um pacote ENIP de ListIdentity
```javascript
 // O Layer Builder é o inicio de tudo onde vc começa a preparar o que vc vai solicitar ao dispositivo
    const layerEtherNetIP = connEthernetIP.getNovoLayerBuilder();

    // Inicialmente, vamos solicitar um comando pra pegar as informações basicas do dispositivo como nome, IP, versão, etc..
    // (isso não é um comando relativo ao protocolo CIP e sim algo do protocolo EtherNet/IP que todo dispositivo tem implementado)

    // O comando que vamos solicitar é o "List Identity" do EtherNet/IP, que retorna informações basicas que descrevem o dispositivo.
    // A função build irá configurar o layer automaticamente com as informações necessarias.
    layerEtherNetIP.buildListIdentity();

    // Agora vamos enviar o pacote construido para o dispositivo
    let aguardaResposta = await connEthernetIP.enviarENIP(layerEtherNetIP);

    // A operação é considerada somente sucesso se a requisição conseguiu ser enviada
    // ao dispositivo E o dispositivo respondeu com sucesso de volta.
    if (!aguardaResposta.isSucesso) {

        // Aqui podemos tratar o erro e saber o que aconteceu
        if (!aguardaResposta.enipEnviar.isEnviou) {

            // Se isEnviou for false, isso indica que nem sequer foi enviada ao dispositivo.
            // Ou não há conexão com o dispositivo, ou o pacote ENIP tem algum erro.

            // Se isGerarBuffer for true, então o erro ocorreu ao gerar o buffer do pacote ENIP.
            // A causa disso pode ter sido em escrever em um offset invalido, algum valor invalido informado em
            // algum campo que não coube no Buffet, etc..
            if (aguardaResposta.enipEnviar.erro.isGerarBuffer) {

                // Se esse for o erro, você pode verificar o traceLog para saber exatamente onde ocorreu o erro.
                // O trace log é um array de mensagens que descreve em ordem exatamente a sequencia de
                // eventos da geração do Buffer, com ele é possível saber exatamente onde ocorreu o erro.
                console.log(`Não foi possível enviar o pacote ENIP, ocorreu um erro ao gerar o buffer: ${aguardaResposta.enipEnviar.erro.descricao}. Trace log da geração: ${aguardaResposta.enipEnviar.erro.erroGerarBuffer.traceLog.join(' -> ')}`);
            } else if (aguardaResposta.enipEnviar.erro.isWriteSocket) {

                // Se isWriteSocket for true, é sem dúvidas algum erro de conexão
                console.log(`Não foi possível enviar o pacote ENIP, ocorreu um erro ao escrever no Socket(ta sem conexão provavélmente): ${aguardaResposta.enipEnviar.erro.descricao}`);
            } else {

                // Pra qualquer outro erro generico.
                console.log(`Ocorreu um erro ao enviar o pacote ENIP: ${aguardaResposta.enipEnviar.erro.descricao}`);
            }

            // Paramos a execução aqui
            return;
        }

        // Se não caiu no if acima, então o pacote foi enviado, mas a resposta não foi processada com sucesso
        if (!aguardaResposta.enipReceber.isRecebeu) {

            // Por padrão, se o dispositivo não responder a solicitação em 9000ms, a solicitação é
            // considerada como "demorou" e o pacote é descartado.
            if (aguardaResposta.enipReceber.erro.isDemorouResposta) {
                console.log(`O dispositivo demorou para responder a solicitação, o pacote será ignorado.`);
            } else {
                // Para erros genéricos 
                console.log(`Ocorreu um erro ao receber a resposta do dispositivo: ${aguardaResposta.enipReceber.erro.descricao}`);
            }

            return;
        }
    }

    // Se chegou até aqui, então a solicitação foi enviada com sucesso e o dispositivo respondeu com sucesso. 

    // Vamos extrair as informações do pacote recebido utilizando o Parser. O Parser é responsável por
    // interpretar o pacote recebido e extrair as informações que queremos. 
    let parserENIPResposta = aguardaResposta.enipReceber.enipParser;

    // Verificar se a resposta recebida é valida(as informações do Buffer recebidas estão corretas). Se não for, então
    // o pacote recebido está corrompido e não deve ser considerado.
    if (!parserENIPResposta.isValido().isValido) {

        // Se não for valido, o Buffer recebido está corrompido e não deve ser considerado. isValido retorna a descrição
        // em qual parte do Buffer deu erro e também tem o Tracer que é um array de mensagens que
        // descreve exatamente a sequencia de eventos que ocorreu até chegar no erro.
        console.log(`O pacote recebido não é valido, não é possivel extrair informações. Motivo: ${parserENIPResposta.isValido().erro.descricao}. Trace log: ${parserENIPResposta.isValido().tracer.getHistoricoOrdenado().join(' -> ')}`);
        return;
    }

    // Lembrando que isValido só verifica se o Buffer recebido está correto. O pacote pode ter
    // sido recebido corretamente, mas a resposta do dispositivo pode ter sido um erro devido a
    // algum comando ilegal. Pra isso existe o comando de getStatus também.

    // Ok, se o Buffer é valido, agora precisamos verificar se o status da solicitação é valido,
    // já que pode ter ocorrido algum erro interno no dispositivo ou alguma informação que não foi possivel ser processada.
    if (!parserENIPResposta.isStatusSucesso().isSucesso) {
        console.log(`O pacote recebido não é um status de sucesso, não é possivel extrair informações. Status recebido: ${parserENIPResposta.getStatus().codigo}: ${parserENIPResposta.getStatus().mensagem}`);
        return;
    }

    // Se o Buffer é valido e com status sucesso, podemos extrair as informações
    // do pacote recebido para o comando que desejamos.

    // Como enviamos um comando ListIdentity, é esperado que a resposta seja também um ListIdentity.
    // Na teoria se você enviou um comando X, ele nunca deve retornar outra coisa além de X, mas sei lá coisas estranhas podem acontecer.
    if (!parserENIPResposta.isListIdentity()) {
        console.log(`O pacote recebido não é um ListIdentity, não é possivel extrair informações.`);
        return;
    }

    // Como é um ListIdentity, chamamos o parser do ListIdentity que irá pegar
    // o Buffer recebido e extrair as informações do ListIdentity.
    const parserListIdentity = parserENIPResposta.getAsListIdentity();

    // Assim como fizemos assim, precisamos validar se o Buffer recebido do
    // ListIdentity é valido e não contém informações corrompidas.
    if (!parserListIdentity.isValido().isValido) {
        console.log(`O pacote recebido do ListIdentity não é valido, não é possivel extrair informações. Motivo: ${parserListIdentity.isValido().erro.descricao}. Trace log: ${parserListIdentity.isValido().tracer.getHistoricoOrdenado().join(' -> ')}`);
        return;
    }

    // Finalmente, se tudo estiver com sucesso, temos acesso as informações do dispositivo solicitadas.
    console.log(parserListIdentity.getIdentidadeCIP());

    // A saida atual constaria algo como:
    //  {
    //     "tipo": 12,
    //     "versao_protocolo_encapsulamento": 1,
    //     "endereco_socket": {
    //         "endereco": "192.168.3.120",
    //         "familia": 2,
    //         "porta": 44818,
    //         "zeros": "00000000"
    //     },
    //     "fabricante_id": 1,
    //     "tipo_dispositivo": 12,
    //     "codigo_produto": 120,
    //     "versao_revisao": "17.4",
    //     "status_dispositivo": 96,
    //     "numero_serial": 1079850447,
    //     "tamanho_nome_dispositivo": 23,
    //     "nome_dispositivo": "1769-L35E Ethernet Port",
    //     "estado_dispositivo": 3
    // }


    // Cada "Parser" precisa ser verificado se é valido e status sucesso. É meio que se fosse um "lego", você recebe todo o Buffer inicial, e vai montando ele aos poucos, e a cada montagem, você precisa verificar se o que você recebeu está no formato que deveria.
    // A mesma lógica aqui irá se aplicar a praticamente todos os Parsers.
```
Todos os comandos do EtherNet/IP seguem a mesma lógica do código acima.

## Implementação do CompactLogix usando o EtherNet/IP
A classe CompactLogix implementa o uso da classe EtherNet/IP pra tratar os pacotes. Ela já vem configurada com a maioria dos metódos úteis de comunicação, leituras unicas e multiplas, escritas unicas e multiplas e obtenção de tags existentes no controlador.

### Comunicando com um CompactLogix

.... terminar
