# Projeto
Esse projeto permite estabelecer conexões via protocolo EtherNet/IP(EtherNet Industrial Protocol) para troca de informações com dispositivos que suportem o protocolo CIP. De inicio, ele fornece uma classe EtherNet/IP que permite abrir uma conexão TCP com o dispositivo remoto, e através dela é possível customizar a informação que vão ser enviadas ao dispositivo.

Outras bibliotecas de EtherNet/IP até fazem a mesma função porém de forma basica e superficial, eu queria algo que tivesse mais controle sobre as informações retornadas e deixasse facíl de interagir com os dispositivos, então decidi criar um do zero.

Não tenho certeza ainda pois só cheguei a implementar um tipo de comunicação até o momento com um controlador CompactLogix da RockWell, mas pelas minhas pesquisas, de forma geral todos os dispositivos que suportam o protocolo CIP possuem até um certo nivel de padrão onde todos devem seguir, e depois disso vem os detalhes especificos que mudam dependendo da fabricante do CLP. Por exemplo, a forma de escrever um valor em um controlador X é diferente no controlador Y. Utilizando a classe EtherNet/IP contida no projeto, é possível customizar livremente todas as informações de um comando CIP para que ele fique compatível com o dispositivo que você deseja se comunicar.

Na pasta Controladores tem uma classe pronta que usa o EtherNet/IP para se comunicar com um CompactLogix. Assim como eu fiz dessa forma, é possível criar outras classes para outros tipos de dispositivos usando como base o EtherNet/IP, você só precisa saber como montar o payload corretamente.

# Builders e Parsers
A classe EtherNet/IP utiliza os Builders/Parsers para auxiliar no gerenciamento dos pacotes ENIPs. 

- Os Builders facilitam a montagem de todos os tipos de comandos disponiveis, sem necessidade de ficar informando onde cada byte deve ficar no Buffer(alguns Builders permitem configurar exatamente os bytes caso necessário).
- Os Parsers auxiliam na leitura dos Buffers recebidos que sejam um pacote EtherNet/IP.

A única tarefa que você precisa fazer para ambos é compor a sequência de comandos.

# Serviços Suportados
- ✅ CIP Connection Manager (Unconnected Messages): O Connection Manager é usado pra enviar mensagens do tipo "UCMM". É uma conexão TCP que fica aberta e funciona no estilo requisição-resposta, onde o dispositivo remoto só devolve alguma informação se você solicitar ela.
- ❌ CIP Connected Messages: Connected Messages utiliza uma conexão UDP para a troca de informações. Ao contrário do UCMM que utiliza o formato requisição-resposta, nesse modo o dispositivo remoto pode enviar informações sem o servidor ter solicitado, no caso isso acontece se você configurar que quer receber tal informação, por exemplo acompanhar em tempo real quando um endereço X mudar de valor.
- ✅ CIP PCCC: O PCCC é usado para transportar os comandos do protocolo DF1 da Rockwell Automation para dispositivos que suportem o CIP PCCC. No mínimo oferece opções de ler e escrever em endereços, e dependendo do dispositivo pode suportar mais comandos diferentes.

# Sumário

- [Projeto](#projeto)
- [Builders e Parsers](#builders-e-parsers)
- [Serviços Suportados](#serviços-suportados)
- [Sumário](#sumário)
- [Como usar](#como-usar)
    - [EtherNet/IP](#ethernetip)
        - [Estabelecendo uma conexão com um dispositivo EtherNet/IP](#estabelecendo-uma-conexão-com-um-dispositivo-ethernetip)
        - [Enviando um pacote ENIP de ListIdentity](#enviando-um-pacote-enip-de-listidentity)
    - [Implementação do CompactLogix usando o EtherNet/IP](#implementação-do-compactlogix-usando-o-ethernetip)
        - [Estabelecendo conexão com um CompactLogix](#estabelecendo-conexão-com-um-compactlogix)
        - [Leitura de Tags](#leitura-de-tags)
        - [Escrita de Tags](#escrita-de-tags)
        - [Listar Tags](#listar-tags)
    - [CompactLogixV2](#compactlogixv2)
        - [Conectar](#conectar-1)
        - [Ler Tags](#ler-tags)
        - [Escrever Tags](#escrever-tags)
        - [Observar Tags](#observar-tags)
        - [Parar Observação de Tags](#parar-observação-de-tags)
    - [MicroLogix 1400](#micrologix-1400)
        - [Conectar](#conectar)
        - [Leitura](#leitura)
        - [Escrita](#escrita)
        - [Observação](#observação)
- [Recursos Utilizados](#recursos-utilizados)

# Como usar
## EtherNet/IP
A classe do EtherNet/IP utiliza o Builder(Monta o pacote de Buffer que vai ser enviado ao dispositivo) e o Parser(Recebe o Buffer e organiza a informação sem muita dor de cabeça). 

### Estabelecendo uma conexão com um dispositivo EtherNet/IP
```javascript
import { EtherNetIPSocket } from "wow-another-ethernet-ip"

async function conectaEtherNetIP() {
    const connEthernetIP = new EtherNetIPSocket({
        conexao: {
            ip: '192.168.3.120',
            porta: 44818,
        },
        isHabilitaLogs: true
    })

    let isConectou = await connEthernetIP.conectar();
    if (!isConectou.isConectou) {
        console.log(`Erro ao conectar com o dispositivo: ${isConectou.erro.descricao}`);
        return;
    }
    console.log(`Conectado com sucesso ao dispositivo. Session Handler é ${connEthernetIP.getSessionHandlerID()}`);

    // A partir daqui, é possível enviar os pacotes ENIPS para o dispositivo.
}
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

### Estabelecendo conexão com um CompactLogix

```javascript
  // Informa os parametros de conexão com o dispositivo
    const compactLogix = new CompactLogixRockwell({
        ip: '192.168.3.120',
        porta: 44818,
        habilitaLogs: true,
        autoReconectar: true
    })

    // A função conectar trata realiza todo o processo de conexão inicial, abertura do Socket, Register Session, etc..
    const aguardaConectar = await compactLogix.conectar();
    if (!aguardaConectar.isConectou) {
        console.log(`Erro ao tentar se conectar ao CompactLogix: ${aguardaConectar.erro.descricao}`);
        return;
    }

    // Após conectado, é possível solicitar leituras de tags, escritas e outras funções disponiveis.
```

É interessante colocar como auto reconectar, pois em caso de perca de conexão ele irá automaticamente tentar se conectar quando possível e já vai iniciar todo aquele trabalho de registrar a sessão.

### Leitura de Tags
No momento, é compatível a leitura de tipos atomicos(numeros no geral, como Small Int, Double int, Int, Double Int, Boolean, Real), Structs tem suporte apenas StringASCII82(no momento somente esse pois é o que eu uso e preciso.) e também arrays, acessando via nomeTag[index]

Segue alguns exemplos abaixos para leituras
```javascript

    // Ler uma unica tag numerica
    const retornoLeituraUnica = await compactLogix.lerTag('TESTE2');
    console.log(retornoLeituraUnica);

    // O retorno da Promise das leituras e escritas é bem verbose na parte de erros, não deixarei visivel porém é bem 
    // extenso e permite saber exatamente quais tipos de erros que ocorreram durante a leitura(sem conexão, erro de buffer, status de erro, tag invalida, etc...)

    // Toda leitura de uma tag retorna o seu valor atual e informações do seu data type no controlador

    // {
    // "isSucesso": true,
    // "tagSolicitada": "TESTE2",
    // "msDetalhes": {
    //     "dateTimeInicio": 1732335653335,
    //     "dateTimeFim": 1732335653404,
    //     "totalMsLeitura": 69
    // },
    // "sucesso": {
    //     "tag": {
    //         "isAtomico": true,
    //         "atomico": {
    //             "valor": 123,
    //             "dataType": {
    //                 "codigo": 196,
    //                 "descricao": "Double Int",
    //                 "tamanho": 4,
    //                 "isSigned": true
    //             }
    //         },
    //         "isStruct": false,
    //         "struct": {}
    //     }
    // }
    // }
    // -------------------------------

    // A resposta contém os booleans isAtomico e isStruct pra determinar onde vc deve buscar o valor correspondente na chave do objeto.

    // Ler uma unica tag do tipo String
    const retornoLerStringUnica = await compactLogix.lerTag('STRING_NOME_OPERADOR')
    console.log(retornoLerStringUnica);
    // {
    // "isSucesso": true,
    // "tagSolicitada": "STRING_NOME_OPERADOR",
    // "msDetalhes": {
    //     "dateTimeInicio": 1732336018190,
    //     "dateTimeFim": 1732336018299,
    //     "totalMsLeitura": 109
    // },
    // "sucesso": {
    //     "tag": {
    //         "isAtomico": false,
    //         "atomico": {},
    //         "isStruct": true,
    //         "struct": {
    //             "dataTypeStruct": {
    //                 "descricao": "String ASCII de 82 bytes",
    //                 "codigoTipoStruct": 4046
    //             },
    //             "valor": {
    //                 "stringConteudo": "NOME OPERADOOO",
    //                 "tamanho": 14
    //             }
    //         }
    //     }
    // }
    // }
    // -------------------------------

     // Ler uma unica tag de um array
    const retornoLeIndiceArray = await compactLogix.lerTag('MINHA_TAG[3]');
    console.log(retornoLeIndiceArray);

    // {
    // "isSucesso": true,
    // "tagSolicitada": "MINHA_TAG[3]",
    // "msDetalhes": {
    //     "dateTimeInicio": 1732336512924,
    //     "dateTimeFim": 1732336513001,
    //     "totalMsLeitura": 77
    // },
    // "sucesso": {
    //     "tag": {
    //         "isAtomico": true,
    //         "atomico": {
    //             "valor": 5,
    //             "dataType": {
    //                 "codigo": 202,
    //                 "descricao": "Real",
    //                 "tamanho": 4,
    //                 "isSigned": true
    //             }
    //         },
    //         "isStruct": false,
    //         "struct": {}
    //     }
    // }
    // }
    // -------------------------------

    // Ler multipltas tag em uma requisição
    const retornoLerVarias = await compactLogix.lerMultiplasTags(['TESTE2', 'TESTE'])
    console.log(retornoLerVarias);

    // A operação de leitura múltipla é considerada sucesso se o pacote ENIP foi enviado e recebido com sucesso.
    // Se houve isSucesso, as tags solicitadas estarão no array sucesso com seus status individuais de cada um.

    // {
    // "isSucesso": true,
    // "sucesso": {
    //     "tags": [
    //         {
    //             "tag": "TESTE",
    //             "isSucesso": true,
    //             "sucesso": {
    //                 "isAtomico": true,
    //                 "atomico": {
    //                     "dataType": {
    //                         "codigo": 202,
    //                         "descricao": "Real",
    //                         "tamanho": 4,
    //                         "isSigned": true
    //                     },
    //                     "valor": 5
    //                 },
    //                 "isStruct": false,
    //                 "struct": {}
    //             },
    //         },
    //         {
    //             "tag": "TESTE2",
    //             "isSucesso": true,
    //             "sucesso": {
    //                 "isAtomico": true,
    //                 "atomico": {
    //                     "dataType": {
    //                         "codigo": 196,
    //                         "descricao": "Double Int",
    //                         "tamanho": 4,
    //                         "isSigned": true
    //                     },
    //                     "valor": 123
    //                 },
    //                 "isStruct": false,
    //                 "struct": {}
    //             }
    //         }
    //     ]
    // }
    // }
```
### Escrita de Tags
Para realizar a escrita é praticamente a mesma coisa. Você pode tanto informar o Data Type no parâmetro da função ou utilizar a opção extra que
automaticamente realiza a descoberta do tipo(solicitando ao controlador).

As escritas retornam sucesso se a operação foi feita com sucesso, e também é retornado as informações do valor escrito junto com seu data type.
```javascript

 // Como já sei o tipo da TESTE2, eu informo no segundo parametro da função. A classe CompactLogix tem os Data Types pra vc saber qual é qual.
 const escreveTag = await compactLogix.escreveTag('TESTE2', {
        isAtomico: true,
        atomico: {
            codigoAtomico: compactLogix.getDataTypes().atomicos.DINT.codigo,
            valor: 5
        }
    });

    console.log(escreveTag);
    // {
    //     "isSucesso": true,
    //     "msDetalhes": {
    //         "dateTimeInicio": 1732336979251,
    //         "dateTimeFim": 1732336979321,
    //         "totalMsEscrita": 70
    //     },
    //     "sucesso": {
    //         "tag": {
    //             "isAtomico": true,
    //             "atomico": {
    //                 "valor": 5,
    //                 "dataType": {
    //                     "codigo": 196,
    //                     "descricao": "Double Int",
    //                     "tamanho": 4,
    //                     "isSigned": true
    //                 }
    //             },
    //             "isStruct": false,
    //             "struct": {}
    //         }
    //     }
    // }
    // -------------------------------

// Escreve uma tag que resolve automaticamente o tipo, informando apenas o valor final que quero
    const escreveTagResolveSozin = await compactLogix.escreveTag('TESTE2', {
        isResolverAutomaticamente: true,
        resolverAutomaticamente: {
            valor: '2'
        }
    });

    console.log(escreveTagResolveSozin);
    // {
    //     "isSucesso": true,
    //     "msDetalhes": {
    //         "dateTimeInicio": 1732337160516,
    //         "dateTimeFim": 1732337160589,
    //         "totalMsEscrita": 73
    //     },
    //     "sucesso": {
    //         "tag": {
    //             "isAtomico": true,
    //             "atomico": {
    //                 "valor": "2",
    //                 "dataType": {
    //                     "codigo": 196,
    //                     "descricao": "Double Int",
    //                     "tamanho": 4,
    //                     "isSigned": true
    //                 }
    //             },
    //             "isStruct": false,
    //             "struct": {}
    //         }
    //     }
    //     }
    // -------------------------------

    const escreveTagResolveSozin2 = await compactLogix.escreveTag('STRING_NOME_OPERADOR', {
        isResolverAutomaticamente: true,
        resolverAutomaticamente: {
            valor: 'ola eu sou uma string'
        }
    });

    console.log(escreveTagResolveSozin2);
    // {
    // "isSucesso": true,
    // "msDetalhes": {
    //     "dateTimeInicio": 1732337320394,
    //     "dateTimeFim": 1732337320436,
    //     "totalMsEscrita": 42
    // },
    // "sucesso": {
    //     "tag": {
    //         "isAtomico": false,
    //         "atomico": {},
    //         "isStruct": true,
    //         "struct": {
    //             "dataTypeStruct": {
    //                 "descricao": "String ASCII de 82 bytes",
    //                 "codigoTipoStruct": 4046
    //             },
    //             "valor": {
    //                 "string": "ola eu sou uma string"
    //             }
    //         }
    //     }
    // }
    // }
    // -------------------------------

    // Para escrever múltiplas tags, informe um array de objetos seguindo o padrão esperado.
    const escreveMultiplasTags = await compactLogix.escreveMultiplasTags([
        {tag: 'TESTE', dataType: {isAtomico: true, atomico: {codigoAtomico: compactLogix.getDataTypes().atomicos.DINT.codigo, valor: 5}}},
        {tag: 'TESTE2', dataType: {isResolverAutomaticamente: true, resolverAutomaticamente: {valor: 5}}},
        {tag: 'STRING_NOME_OPERADOR', dataType: {isResolverAutomaticamente: true, resolverAutomaticamente: {valor: 'eu sooo a strinng'}}}
    ])

    console.log(escreveMultiplasTags);

    // Para as escritas de multiplas tags, a chave isSucesso é considerada sucesso se o pacote ENIP foi transmitido e recebido de volta.
    // E então, cada tag é retornado com seu status individual da operação da escrita, com detalhes de erro ou sucesso.

    // Nessa solicitação especifiquei errado de proposito o Data Type da tag TESTE pra mostrar de forma superficial como o erro é exibido. 

    // {
    // "isSucesso": true,
    // "sucesso": {
    //     "tags": [
    //         {
    //             "tag": "TESTE",
    //             "dataTypeDados": {
    //                 "isValido": true,
    //                 "isAtomico": true,
    //                 "isStruct": false,
    //                 "atomico": {
    //                     "codigoAtomico": 196,
    //                     "valor": 5
    //                 },
    //                 "struct": {}
    //             },
    //             "isSucesso": false,
    //             "erro": {
    //                 "descricao": "O pacote Single Service Packet retornou um status de erro: 255 - Specific Object Class Error/ Data Type informado para a tag é incorreto",
    //                 "isSingleServicePacketStatusErro": true,
    //                 "SingleServicePacketStatusErro": {
    //                     "codigoStatus": 255,
    //                     "descricaoStatus": "Specific Object Class Error",
    //                     "isTagNaoExiste": false,
    //                     "isDataTypeIncorreto": true,
    //                     "additionalStatusBuffer": {
    //                         "type": "Buffer",
    //                         "data": [
    //                             7,
    //                             33
    //                         ]
    //                     }
    //                 }
    //             }
    //         },
    //         {
    //             "tag": "TESTE2",
    //             "dataTypeDados": {
    //                 "isValido": true,
    //                 "isAtomico": true,
    //                 "isStruct": false,
    //                 "atomico": {
    //                     "codigoAtomico": 196,
    //                     "valor": 5
    //                 },
    //                 "struct": {}
    //             },
    //             "isSucesso": true
    //         },
    //         {
    //             "tag": "STRING_NOME_OPERADOR",
    //             "dataTypeDados": {
    //                 "isValido": true,
    //                 "isAtomico": false,
    //                 "isStruct": true,
    //                 "atomico": {},
    //                 "struct": {
    //                     "classeStruct": {
    //                         "string": "eu sooo a strinng"
    //                     },
    //                     "codigoStruct": 4046
    //                 }
    //             },
    //             "isSucesso": true,
    //         }
    //     ]
    // }
    // }
    // -------------------------------
    

     // Tentar escrever uma tag que não existe informando pra resolver automaticamente
    const escreveTagNaoExiste = await compactLogix.escreveTag('DASDSADA', {
        isResolverAutomaticamente: true,
        resolverAutomaticamente: {
            valor: '2'
        }
    })

    console.log(escreveTagNaoExiste);

    // {
    // "isSucesso": false,
    // "msDetalhes": {
    //     "dateTimeInicio": 1732338339214
    // },
    // "sucesso": {
    //     "tag": {
    //         "isAtomico": false,
    //         "atomico": {},
    //         "isStruct": false,
    //         "struct": {}
    //     }
    // },
    // "erro": {
    //     "descricao": "Erro ao tentar resolver automaticamente o Data Type da tag DASDSADA: A tag não existe.",
    //     "isObterDataTypeAutomatico": true,
    // }
    // }

    // Nesse caso, como o erro é inicialmente em tentar obter o Data Type, ele informa isObterDataTypeAutomatico
    // -------------------------------

    // Tentar escrever uma tag que não existe, informando o tipo dessa vez
      const escreveTagNaoExisteComTipo = await compactLogix.escreveTag('DASDSADA', {
        isAtomico: true,
        atomico: {
            codigoAtomico: compactLogix.getDataTypes().atomicos.DINT.codigo,
            valor: 5
        }
    })

    console.log(escreveTagNaoExisteComTipo);

    // {
    // "isSucesso": false,
    // "msDetalhes": {
    //     "dateTimeInicio": 1732338492426,
    //     "dateTimeFim": 1732338492480,
    //     "totalMsEscrita": 54
    // },
    // "sucesso": {
    //     "tag": {
    //         "isAtomico": true,
    //         "atomico": {
    //             "valor": 5,
    //             "dataType": {
    //                 "codigo": 196,
    //                 "descricao": "Double Int",
    //                 "tamanho": 4,
    //                 "isSigned": true
    //             }
    //         },
    //         "isStruct": false,
    //         "struct": {}
    //     }
    // },
    // "erro": {
    //     "descricao": "A tag não existe no controlador",
    //     "isStatusInvalido": true,
    //     "statusInvalido": {
    //         "descricaoStatus": "Path segment error",
    //         "codigoDeErro": 4,
    //         "isTagNaoExiste": true,
    //         "isDataTypeIncorreto": false
    //     },
    // }
    // }

    // Nesse caso eu informei o Data Type, porém a tag não existe no controlador.
```
### Listar Tags

É possível solicitar a lista de todas as tags presentes no CompactLogix com seus Data Types inclusos

```javascript
    // Solicitar a lista de todas as tags. Dependendo do numero de tags pode demorar alguns segundos.
    const solicitaListaTags = await compactLogix.obterListaDeTags();
    console.log(solicitaListaTags);

    // O retorno contém o data type, instancia dela no controlador e se ela é suportada atualmente para interagir utilizando essa classe
    // {
    // "isSucesso": true,
    // "sucesso": {
    //     "tags": [
    //         {
    //             "tag": "TAG1",
    //             "instancia": 7,
    //             "dataType": {
    //                 "classeDataType": {
    //                     "codigo": 195,
    //                     "descricao": "Int",
    //                     "tamanho": 2,
    //                     "isSigned": true
    //                 },
    //                 "isAtomico": true,
    //                 "isStruct": false,
    //                 "isDataTypeSuportado": true,
    //                 "dataTypeNaoSuportado": {}
    //             }
    //         },
    //         {
    //             "tag": "TAG2",
    //             "instancia": 119,
    //             "dataType": {
    //                 "classeDataType": {
    //                     "codigo": 195,
    //                     "descricao": "Int",
    //                     "tamanho": 2,
    //                     "isSigned": true
    //                 },
    //                 "isAtomico": true,
    //                 "isStruct": false,
    //                 "isDataTypeSuportado": true,
    //                 "dataTypeNaoSuportado": {}
    //             }
    //         },
    //         {
    //             "tag": "TAG3",
    //             "instancia": 143,
    //             "dataType": {
    //                 "classeDataType": {
    //                     "codigo": 195,
    //                     "descricao": "Int",
    //                     "tamanho": 2,
    //                     "isSigned": true
    //                 },
    //                 "isAtomico": true,
    //                 "isStruct": false,
    //                 "isDataTypeSuportado": true,
    //                 "dataTypeNaoSuportado": {}
    //             }
    //         },
    //         {
    //             "tag": "G6_DADOS",
    //             "instancia": 185,
    //             "dataType": {
    //                 "classeDataType": {},
    //                 "isAtomico": false,
    //                 "isStruct": false,
    //                 "isDataTypeSuportado": false,
    //                 "dataTypeNaoSuportado": {
    //                     "codigo": 4095,
    //                     "descricao": "Data Type não é atomico e nem struct."
    //                 }
    //             }
    //         },
    //         {
    //             "tag": "TAG5",
    //             "instancia": 189,
    //             "dataType": {
    //                 "classeDataType": {
    //                     "codigo": 195,
    //                     "descricao": "Int",
    //                     "tamanho": 2,
    //                     "isSigned": true
    //                 },
    //                 "isAtomico": true,
    //                 "isStruct": false,
    //                 "isDataTypeSuportado": true,
    //                 "dataTypeNaoSuportado": {}
    //             }
    //         }
    //     ]
    // },
    // }
```

## MicroLogix 1400
A classe Micrologix 1400, permite comunicação com modelos A/B e oferece suporte para as seguintes operações:

- ** Leitura de Data Files
- ** Escrita de Data Files
- ** Observações de Data Files

No momento, foi testado apenas para valores de Data Files (N) e (ST).

### Conectar
```javascript

    const micoLogix = new MicroLogix1400({
        ip: '192.168.3.190',
        porta: 44818,
        autoReconectar: false,
        habilitaLogs: true
    })

    // Tentar se conectar
    let statusConecta = await micoLogix.conectar();

    if (!statusConecta.isConectou) {
        console.log(`Não foi possível se conectar: ${statusConecta.erro.descricao}`);
        return;
    }

    console.log(`MicroLogix conectado com sucesso!`);

    // Conectado
```

### Leitura
As leituras são feitas através de Data Files, onde você pode especificar o tipo de dado que deseja ler. Devido
as limitações do protocolo CIP via PCCC para MicroLogix, não é possível ler ou escrever múltiplos Data Files em uma única requisição, então cada 
leitura e escrita é feita de forma individual.

```javascript

    // Ler o Data File tipo inteiro, identificado pelo número 7, e o elemento 33 dentro desse Data File
    const lerN7_33 = await micoLogix.lerDataFile('N7:33');
    if (lerN7_33.isSucesso) {
        console.log(`Meu número N7:33 é ${lerN7_33.sucesso.valor}`);
    } else {
        console.error(`Erro ao ler N7:33: ${lerN7_33.erro.descricao}`);
    }

    // Ler o Data File tipo string, identificado pelo número 10, e o elemento 5 dentro desse Data File
    const lerST_5 = await micoLogix.lerDataFile('ST10:5');
    if (lerST_5.isSucesso) {
        console.log(`Minha string ST10:5 é ${lerST_5.sucesso.valor}`);
    } else {
        console.error(`Erro ao ler ST10:5: ${lerST_5.erro.descricao}`);
    }
```

Sempre é bom ficar atento ao objeto de isSucesso, se ela for false, a leitura falhou e você deve verificar o objeto de erro para mais informações. Possíveis
erros podem ser: O Data File não existe, o tipo de dado não é suportado, o dispositivo não está conectado, etc.

### Escrita
Os métodos de escrita são quase idênticos aos de leitura, mas você deve informar o valor que deseja escrever no Data File
```javascript

    // Escrever o número 1234 no Data File tipo inteiro, identificado pelo número 7, e o elemento 55 dentro desse Data File
    const escreveN7_55 = await micoLogix.writeDataFile('N7:55', 1234);
    if (escreveN7_55.isSucesso) {
        console.log(`Escrevi com sucesso o número 1234 em N7:55`);
    } else {
        console.error(`Erro ao escrever N7:55: ${escreveN7_55.erro.descricao}`);
    }

    // Escrever a string "Ola, mundo!"(yeah sem acento) no Data File tipo string, identificado pelo número 10, e o elemento 5 dentro desse Data File
    const escreveST = await micoLogix.writeDataFile('ST10:5', 'Ola, mundo!');
    if (escreveST.isSucesso) {
        console.log(`Escrevi com sucesso a string "Ola, mundo!" em ST10:5`);
    } else {
        console.error(`Erro ao escrever ST10:5: ${escreveST.erro.descricao}`);
    }
```

### Observação
Para observar um Data File, você deve informar o nome do Data File e o callback que será chamado quando o valor do Data File mudar.
```javascript

    const statusObservaString = await microLogix.observarDataFile('ST10:5', {
        // Toda vez que o valor desse Data File for alterado, esse callback é chamado
        onDataFileAlterado: (valorAntigo, valorNovo) => {
            console.log(`Valor antigo: ${valorAntigo}, novo valor: ${valorNovo}`);
        },
        // Toda vez que um erro de leitura do Data File ocorrer, esse callback é chamado
        onErroLeitura: (erro) => {
            console.error(`Erro ao ler Data File: ${erro}`);
        }
    });
    
        // Só não será possível observar se ocorrer algum erro de leitura no Data File solicitado
    if (statusObservaString.isSucesso) {
        console.log(`Observação de Data File ST10:5 iniciada com sucesso! ID do callback: ${statusObservaString.sucesso.idCallback}`);

        setTimeout(() => {
            // Para parar a observação, basta chamar o método pararObservacaoDataFile passando o ID do callback retornado
            microLogix.pararObservadorUnicoDataFile('ST10:5', statusObservaString.sucesso.idUnicoCallback);


            // Ou, se você quiser, parar todas as observações de um endereço Data File específico
            microLogix.pararObservarDataFile('ST10:5');
        }, 10000);
    } else {
        console.log(`Erro ao iniciar observação de Data File: ${statusObservaString.erro.descricao}`);
    }

```

## CompactLogixV2
A classe CompactLogixV2 utiliza a classe CompactLogix como base para facilitar ainda mais a comunicação com o CompactLogix. 

CompactLogix oferece as comunicações básicas: leitura e escrita de forma livre sem restrições, utilize ela caso queira customizar sua interação com o dispositivo.

CompactLogixV2 usa a CompactLogix para oferecer uma implementação robusta de leitura, escrita e observação de tags. As operações de leituras e escritas são colocadas em filas separadas para executar a cada X millisegundos, assim
chamadas subsequentes em um for ou algo do tipo não irão spamar o dispositivo com requisições.

### Conectar
```javascript

 // Conectar com um CompactLogix
    const controlador = new CompactLogixV2({
        conexao: {
            ip: '192.168.3.120',
            porta: 44818
        },
        isAutoReconectar: true,
        isMostrarConsoleLogs: true
    })

    const statusConectou = await controlador.conectar();
    if (!statusConectou.isConectado) {
        console.log(`Erro ao conectar-se: ${statusConectou.erro.descricao}`);

        return;
    }

    console.log(`Conectado`)

    // Conectado
```

### Ler Tags
Realiza leituras de tags(Disponível somente leitura de múltiplas tags).

```javascript
     // Ler tags
    const leTag = await controlador.lerTags(['TESTE2', 'TESTE']);
    console.log(leTag);

//     {
//     "isSucesso": true,
//     "sucesso": {
//         "tags": [
//             {
//                 "tag": "TESTE2",
//                 "valor": {
//                     "isAtomico": true,
//                     "atomico": {
//                         "numero": 456
//                     }
//                 },
//                 "erro": {
//                     "descricao": ""
//                 },
//                 "isLeituraRecebida": true,
//                 "isTagValida": true,
//                 "dataType": {
//                     "isAtomico": true,
//                     "atomico": {
//                         "codigoAtomico": 196,
//                         "descricao": "Double Int",
//                         "isSigned": true,
//                         "tamanho": 4
//                     }
//                 }
//             },
//             {
//                 "tag": "TESTE",
//                 "valor": {
//                     "isAtomico": true,
//                     "atomico": {
//                         "numero": 6.866362475191604e-44
//                     }
//                 },
//                 "erro": {
//                     "descricao": ""
//                 },
//                 "isLeituraRecebida": true,
//                 "isTagValida": true,
//                 "dataType": {
//                     "isAtomico": true,
//                     "atomico": {
//                         "codigoAtomico": 202,
//                         "descricao": "Real",
//                         "isSigned": true,
//                         "tamanho": 4
//                     }
//                 }
//             }
//         ]
//     },
// }
```

### Escrever Tags
Realiza escritas de tags(Disponível somente escrita de múltiplas tags)

```javascript
 // Escrever tags
    const escreveTags = await controlador.escreverTags([
        { tag: 'TESTE2', valor: 5 }
    ])
    console.log(escreveTags);

//     {
//     "isSucesso": true,
//     "sucesso": {
//         "tags": [
//             {
//                 "tag": "TESTE2",
//                 "valor": 5,
//                 "isEscritoSucesso": true,
//                 "erro": {
//                     "descricao": ""
//                 },
//                 "isRecebidoConfirmacao": true
//             }
//         ]
//     },
//     "erro": {
//         "descricao": ""
//     }
// }
```

### Observar Tags
Realiza o cadastro de um observador em uma tag. Quando o valor da tag mudar, o callback passado será executado com os valores antigos e novos.

A classe lida com o cadastro de callbacks de forma eficiente pra cada tag, então não se preocupe em spamar observações na mesma tag.
```javascript
 // Observar tags
    const observaTags = await controlador.observarTag('TESTE2', {
        onAlterado: (antigo, novo) => {
            console.log(`Valor antigo: ${JSON.stringify(antigo)}, novo valor: ${JSON.stringify(novo)}`);

            // Valor antigo: {"isAtomico":true,"atomico":{"numero":123}}, novo valor: {"isAtomico":true,"atomico":{"numero":456}}

            // Valor antigo: {"isAtomico":true,"atomico":{"numero":456}}, novo valor: {"isAtomico":true,"atomico":{"numero":123}}
        }
    })

    if (observaTags.isSucesso) {

        // A observação com sucesso retorna um ID de callback para cancelar a observação posteriormente.
        console.log(`TAG observada com sucesso via ID ${observaTags.sucesso.idCallback}`);

        setTimeout(() => {
            console.log('Parando observação da tag TESTE2');
            controlador.pararCallbackObservacaoTag('TESTE2', observaTags.sucesso.idCallback);
        }, 5000);
    }
```

### Parar Observação de Tags
```javascript
// Isso irá remover o observador ID 2 da tag TESTE2, enquanto outros observadores da tag continuam sendo chamados.
controlador.pararCallbackObservacaoTag('TESTE2', 2);

// Isso irá remover TODOS os observadores da tag.
controlador.pararObservacaoTag('TESTE2');
```

## Recursos Utilizados
Utilizei outras bibliotecas como st-ethernet-ip e ethernet-ip pra ter uma ideia de como iniciar, utilizei também os manuais da AODV de implementação do EtherNet/IP e CIP(esta nos documentos aqui do projeto), e também a ferramente WireShark que me auxiliou bastante pra entender e fazer os Parsers e Builders dos bytes que são enviados e recebidos.