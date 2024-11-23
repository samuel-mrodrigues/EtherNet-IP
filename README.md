# Projeto
Esse projeto permite estabelecer conexões via protocolo EtherNet/IP(EtherNet Industrial Protocol) para troca de informações com dispositivos que suportem o protocolo CIP. De inicio, ele fornece uma classe EtherNet/IP que permite abrir uma conexão TCP com o dispositivo remoto, e através dela é possível customizar a informação que vai ser enviada ao dispositivo.

Outras bibliotecas de EtherNet/IP até fazem a mesma função porém de forma muito basica e superficial, eu queria algo que tivesse mais controle sobre as informações retornadas e deixasse facíl de interagir com os dispositivos, então decidi criar um do zero.

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

### Estabelecendo conexão com um CompactLogix

```javascript
  // Informa os parametros de conexão com o dispositivo
    const compactLogix = new CompactLogixRockwell({
        ip: '192.168.3.120',
        porta: 44818,
        habilitaLogsEtherNetIP: true,
        habilitarLogsCompactLogix: true,
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
No momento, é compatível a leitura de tipos atomicos(numeros no geral, como Small Int, Double int, Int, Double Int, Boolean, Real), Structs suporte apenas StringASCII82(no momento somente esse pois é o que eu uso e preciso.) e também arrays, acessando via nomeTag[index]

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
    const retornoLeIndiceArray = await compactLogix.lerTag('BD_G2_MOTIVO_DIA_1[3]');
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

    // A operação de leitura multiplica é considera sucesso se o pacote ENIP foi enviado e recebido com sucesso.
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
Para realizar a escrita é praticamente a mesma coisa. Você pode tanto informar o data type no parametro da função, ou utilizar a opção extra que
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

    // O retorno contém o data type, instancia dela no controlador, e se ela é suportada atualmente para interagir utilizando essa classe
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
## Recursos Utilizados
Utilizei outras bibliotecas como st-ethernet-ip e ethernet-ip pra ter uma ideia de como iniciar, utilizei também os manuais da AODV de implementação do EtherNet/IP e CIP(esta nos documentos aqui do projeto), e também a ferramente WireShark que me auxiliou bastante pra entender e fazer os Parsers e Builders dos bytes que são enviados e recebidos.
