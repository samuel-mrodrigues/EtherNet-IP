import { CIPGeneralStatusCodes } from "../../../EtherNetIP/Utils/CIPRespondeCodes.js";
import { EtherNetIPSocket } from "../../../EtherNetIP/EtherNetIP.js";
import { EmissorEvento } from "../../../Utils/EmissorEvento.js";
import { SingleServicePacketServiceBuilder } from "../../../EtherNetIP/Builder/Layers/EtherNetIP/CommandSpecificDatas/SendRRData/CIP/Servicos/CIPConnectionManager/SingleServicePacket/SingleServicePacket.js";


/**
 * Comunicação com o controlador CompactLogix da Rockwell
 */
export class CompactLogixRockwell {

    /**
     * @type {EtherNetIPSocket} - Socket de comunicação com o dispositivo remoto no protocolo EtherNet/IP
     */
    #ENIPSocket;

    #configuracao = {
        ip: '',
        porta: 0,
        logs: {
            habilitarLogsConsole: false
        }
    }

    /**
     * @typedef DataTypeTagAtomico
     * @property {Number} codigo - Codigo do DataType no controlador
     * @property {String} descricao - Descrição do DataType
     * @property {Number} tamanho - Tamanho do tipo do DataType em bytes 
     * @property {Boolean} isSigned - Se o DataType é um número com sinal
     */

    /**
     * @typedef DataTypeTagStruct
     * @property {Number} codigoTipoStruct - O código de identificação desse tipo de Struct. Todas as tags Struct possuem o Data Type Code 672, o codigoStruct é um identificador único para cada tipo de Struct
     * @property {String} descricao - Descrição do DataType
     */

    /**
     * @typedef DataTypeTagStructASCIIString82
     * @property {String} stringConteudo - Conteudo da string
     * @property {Number} tamanho - Tamanho total da string em bytes
     */

    #estado = {
        /**
         * Emissor de eventos do CompactLogix
         */
        emissorEvento: new EmissorEvento(),
    }

    /**
     * Parametros de conexão com o controlador CompactLogix
     * @param {Object} parametros
     * @param {String} parametros.ip - Endereço IP do controlador CompactLogix
     * @param {Number} parametros.porta - Porta de comunicação com o controlador CompactLogix
     * @param {Boolean} parametros.habilitaLogs - Se os logs devem ser exibidos no console
     * @param {Boolean} parametros.autoReconectar - Se deve tentar reconectar automaticamente em caso de: 1 - Perda de conexão com o controlador, 2 - Desautenticação com o dispositivo por algum motivo(acho raro acontecer '-')
     */
    constructor(parametros) {
        if (parametros == undefined || typeof parametros != 'object') throw new Error('Parâmetros de conexão não informados');
        if (parametros.ip == undefined) throw new Error('Endereço IP não informado');
        if (parametros.porta == undefined) throw new Error('Porta de comunicação não informada');

        this.#configuracao.ip = parametros.ip;
        this.#configuracao.porta = parametros.porta;

        let isHabLogs = false;
        if (parametros.habilitaLogs) isHabLogs = true;


        this.#configuracao.logs.habilitarLogsConsole = isHabLogs;

        this.#ENIPSocket = new EtherNetIPSocket({
            isHabilitaLogs: false,
            conexao: {
                ip: this.#configuracao.ip,
                porta: this.#configuracao.porta
            },
            isAutoReconnect: parametros.autoReconectar
        });

        this.#ENIPSocket.onLog((msgLog) => {
            this.log(msgLog);
        });
    }

    /**
     * Conectar o Socket EtherNet/IP.
     */
    async conectar() {

        /**
         * @typedef conectarRetorno
         * @property {Boolean} isConectou - Se a conexão foi bem sucedida
         * @property {Object} erro - Se não conectou, contém os detalhes do motivo
         * @property {String} erro.descricao - Descrição do erro ocorrido
         * @property {Boolean} erro.isSemConexao - Se o erro foi causado por não conseguir conectar ao controlador
         * @property {Boolean} erro.isAutenticar - Se o erro foi causado devido ao erro de tentar estabelecer a conexão com o RegisterSession
         * @property {Boolean} erro.isDispositivoRecusou - Se o erro foi causado devido ao dispositivo recusar a conexão
         */

        /**
         * @type {conectarRetorno}
         */
        const retornoConexao = {
            isConectou: false,
            erro: {
                descricao: '',
                isAutenticar: false,
                isDispositivoRecusou: false,
                isSemConexao: false
            }
        }

        let retornoConectar = await this.#ENIPSocket.conectar();

        // Se o EtherNet/IP não conseguiu se conectar
        if (!retornoConectar.isConectou) {

            if (retornoConectar.erro.isSemConexao) {
                retornoConexao.erro.descricao = 'Sem comunicação com o dispositivo remoto';
                retornoConexao.erro.isSemConexao = true;
            } else if (retornoConectar.erro.isFalhaAutenticar) {
                retornoConexao.erro.descricao = `Falha ao autenticar com o dispositivo remoto: ${retornoConectar.erro.descricao}`;
                retornoConexao.erro.isAutenticar = true;
            } else if (retornoConectar.erro.isDispositivoRecusou) {
                retornoConexao.erro.descricao = 'Dispositivo remoto recusou a conexão';
                retornoConexao.erro.isDispositivoRecusou = true;
            } else {
                retornoConexao.erro.descricao = `Erro ao tentar se conectar: ${retornoConectar.erro.descricao}`;
            }
        } else {
            retornoConexao.isConectou = true;
        }

        return retornoConexao;
    }

    /**
     * Desconectar o Socket EtherNet/IP. É enviado ao dispositivo a solicitação de UnRegister Session para excluir a sessão da memoria e o Socket TCP é destruido junto.
     ** Mesmo que o comando não seja enviado(por exemplo se esta sem conexão com o dispositivo), o socket é destruido de qualquer forma e é necessario conectar novamente.
     */
    async desconectar() {
        await this.#ENIPSocket.desconectar();
    }

    /**
     * Retorna se o Socket de comunicação com o controlador CompactLogix está conectado(Isso não é o mesmo que se está autenticado, apenas informa se o socket TCP está aberto)
     */
    isSocketConectado() {
        return this.#ENIPSocket.getEstadoConexao().isConectado;
    }

    /**
     * Retorna se a autenticação está estabelecida com o controlador CompactLogix
     ** Se estiver desconectado, isso será false, então da pra usar esse cara pra saber se tá tudo conectado certo ou não
     */
    isAutenticado() {
        return this.#ENIPSocket.getEstadoAutenticacao().isAutenticado;
    }

    /**
     * Ativa/desativa os logs no console
     * @param {Boolean} bool 
     */
    toggleLogs(bool = false) {

        this.#configuracao.logs.habilitarLogsConsole = bool;
    }

    /**
     * @callback CallbackLog
     * @param {String} mensagem - Mensagem disparada no log
     */

    /**
     * Adicionar um callback para quando um log for disparado
     * @param {CallbackLog} cb 
     */
    onLog(cb) {
        this.#estado.emissorEvento.addEvento('log', cb);
    }

    /**
     * Retornar o Socket de comunicação com o dispositivo EtherNet/IP
     */
    getENIPSocket() {
        return this.#ENIPSocket;
    }

    /**
     * Realizar a leitura de uma unica tag do CompactLogix
     * @param {String} tag - Tag a ser lida
     */
    async lerTag(tag) {
        if (tag == undefined) throw new Error('Tag a ser lida não informada');
        if (typeof tag != 'string') throw new Error('Tag a ser lida deve ser uma string');
        if (tag == '') throw new Error('Tag a ser lida não pode ser vazia');

        const retornoTag = {
            /**
             * Se deu sucesso em realizar a leitura da tag 
             */
            isSucesso: false,
            tagSolicitada: tag,
            /**
             * Detalhes dos tempos de leitura da tag
             */
            msDetalhes: {
                /**
                 * Data atual em millisegundos de quando a leitura foi iniciada e o pacote ENIP foi enviada
                 * @type {Number}
                 */
                dateTimeInicio: new Date().getTime(),
                /**
                 * Data atual em millisegundos de quando o pacote ENIP foi recebido e parseado
                 * @type {Number}
                 */
                dateTimeFim: undefined,
                /**
                 * Tempo em ms total de leitura da tag
                 */
                totalMsLeitura: undefined
            },
            /**
             * Se sucesso, contém os dados da tag lida
             */
            sucesso: {
                tag: {
                    /**
                     * Se o valor lido é atomico(numeros DataType de 193 a 202)
                     */
                    isAtomico: false,
                    /**
                     * Se isAtomico, contém os detalhes do valor lido
                     */
                    atomico: {
                        /**
                         * O valor númerico
                         */
                        valor: undefined,
                        /**
                         * O DataType do valor lido
                         */
                        dataType: undefined
                    },
                    /**
                     * Se o valor lido é do tipo de uma Struct
                     */
                    isStruct: false,
                    /**
                     * Se Struct, contém os detalhes da Struct
                     */
                    struct: {
                        /**
                         * O Data Type da Struct lido
                         * @type {DataTypeTagStruct}
                         */
                        dataTypeStruct: undefined,
                        /**
                         * O valor da Struct lido. Esse campo é dinamico depenendo do tipo da Struct
                         * @type {DataTypeTagStructASCIIString82}
                         */
                        valor: undefined
                    }
                }
            },
            /**
             * Detalhes especificos do tipo do erro que foi ocorrido se isSucesso não for true
             */
            erro: {
                descricao: '',
                /**
                 * Se foi erro ao enviar o pacote ENIP
                 */
                isEnviarENIP: false,
                /**
                 * Se o erro foi causado devido a falha ao enviar o pacote ENIP, contém os detalhes extras desse erro
                */
                enviarENIP: {
                    /**
                     * Se foi erro ao escrever o pacote ENIP no socket
                     */
                    isWriteSocket: false,
                    /**
                     * Se foi erro ao gerar o buffer do pacote ENIP
                     */
                    isGerarBuffer: false,
                    /**
                     * Detalhes do erro ao gerar o Buffer do pacote ENIP se isGerarBuffer for true
                     */
                    gerarBuffer: {
                        /**
                         * Histórico de logs do erro ao gerar o Buffer do pacote ENIP
                         */
                        traceLog: []
                    }
                },
                /**
                 * Se foi erro ao receber o pacote ENIP
                 */
                isReceberENIP: false,
                /**
                 * Se o erro foi causado devido a falha ao receber o pacote ENIP, contém os detalhes extras desse erro. Esse erro só verifica pelo campo principal ENIP, os layers encapsulados posteriormente podem ter erros próprios,
                 * porém a garantia aqui é que o pacote ENIP foi recebido com sucesso
                */
                receberENIP: {
                    /**
                     * Se foi erro ao receber o pacote ENIP
                     */
                    isDemorouResposta: false
                },
                /**
                 * O pacote EtherNet/IP retornado não retornou sucesso
                 */
                isENIPStatusErro: false,
                /**
                 * Se isENIPStatusErro, contém os detalhes do erro
                 */
                ENIPStatusErro: {
                    /**
                     * Código de identificação do erro
                     */
                    codigo: '',
                    /**
                     * Descrição da identificação do erro
                     */
                    mensagem: ''
                },
                /**
                 * Se o erro ocorrido foi devido a algum dos layers do pacote ENIP recebido estarem incorretos. É somente para erros de parse dos Buffers recebidos e suas camadas e garantir que os bytes recebidos estão em conformidade. Por exemplo
                 * se foi requisitado ler uma tag que não existe, o controlador vai responder com um status de invalido no SingleServicePacket, então não caira em tratativas dos erros, e sim de status.
                 */
                isErroLayers: false,
                /**
                 * Se isErroLayers, contém qual layer ocorreu o erro
                 */
                erroLayers: {
                    /**
                     * Se o primeiro layer que é o EtherNet/IP é o que está com erros
                     */
                    isENIPInvalido: false,
                    /**
                     * Se isENIPInvalido, contém os detalhes do erro
                     */
                    ENIPInvalido: {
                        /**
                         * Array de mensagens com o historico de cada etapa do processamento do Buffer, conterá onde ocorreu o erro no Buffer
                         */
                        trace: []
                    },
                    /**
                     * Se o layer do SendRRData é valido
                     */
                    isSendRRDataInvalido: false,
                    /**
                     * Se o erro foi causado por falha ao processar o Buffer SendRRData
                     */
                    sendRRDataInvalido: {
                        /**
                         * Array de mensagens com o historico de cada etapa do processamento do Buffer, conterá onde ocorreu o erro no Buffer
                         */
                        trace: []
                    },
                    /**
                     * Se o layer do CIP é valido
                     */
                    isCIPInvalido: false,
                    /**
                     * Se o erro foi causado por falha ao processar o Buffer CIP
                     */
                    CIPInvalido: {
                        /**
                         * Array de mensagens com o historico de cada etapa do processamento do Buffer, conterá onde ocorreu o erro no Buffer
                         */
                        trace: []
                    },
                    /**
                     * Se o layer Single Service Packet é valido
                     */
                    isSingleServicePacket: false,
                    /**
                     * Se o erro foi causado por falha ao processar o Buffer Single Service Packet
                     */
                    singleServicePacket: {
                        /**
                         * Array de mensagens com o historico de cada etapa do processamento do Buffer, conterá onde ocorreu o erro no Buffer
                         */
                        trace: []
                    }
                },
                /**
                 * Se o erro foi causado devido a um erro de status, ou seja os layers estão todos em conformidade, porém o dispositivo retornou um status diferente de sucesso para a operação de leitura da tag(Esse erro é somente para o CIP)
                 */
                isStatusInvalido: false,
                /**
                 * Se isStatusInvalido, contém os detalhes do status invalido
                 */
                statusInvalido: {
                    /**
                     * A descrição basica do erro original ocorrido
                     */
                    descricaoStatus: '',
                    /**
                     * Código do erro recebido conforme CIP Response Codes
                     */
                    codigoDeErro: undefined,
                    /**
                     * Opcionalmente um Additional Status code se disponível. Geralmente se o status for sucesso, esse campo é ignorado
                     * @type {Buffer}
                     */
                    additionalStatusCode: undefined,
                    /**
                     * A tag não existe
                     */
                    isTagNaoExiste: false,
                    /**
                     * A tag existe, porém foi solicitado um index que não existe no controlador
                     */
                    isIndexArrayNaoExiste: false
                },
                /**
                 * Se o erro foi causado devido a um erro de conversão do Buffer recebido no ENIP para o valor real(numero, string, array, etc..)
                 */
                isConverterValor: false
            }
        }

        const layerENIP = this.getENIPSocket().getNovoLayerBuilder();
        const layerConnectionManager = layerENIP.buildSendRRData().criarServicoCIP().buildCIPConnectionManager();

        // O Single Service Packet eu configuro qual vai ser a tag solicitada
        const layerServicePacket = layerConnectionManager.getCIPMessage().buildSingleServicePacket();

        // Validar se o usuario informou uma tag de array dimensinal (verificar se existe o [] e o index dentro)
        let isArrayIndex = tag.match(/\[\d+\]/g);

        // Se contiver o index do numero
        if (isArrayIndex) {

            // Cortar somente o nome da tag sem os []
            let nomeTagCortadad = tag.split('[')[0];
            let indexSolicitado = parseInt(isArrayIndex[0].replace('[', '').replace(']', ''));

            // Para leituras de tags que correspondem a localização de um array, devo incluir o Member Request Path que inclua qual o membro(index do array no CompactLogix)
            layerServicePacket.setAsGetAttribute({
                nome: `${nomeTagCortadad}`,
                CIPGenericBuffer: Buffer.from([0x01, 0x00]),
                MemberRequestPath: Buffer.from([0x28, indexSolicitado])
            })
        } else {
            // Pra ler uma tag pelo menos no CompactLogix, o CIP Generic data deve ser só o Request Path pra string da tag, e o CIP Class Generic é só um array vazio já que não precisa enviar informações
            layerServicePacket.setAsGetAttribute({
                nome: `${tag}`,
                CIPGenericBuffer: Buffer.from([0x01, 0x00])
            })
        }

        this.log(`Lendo tag ${tag}...`);

        // Enviar o pacote ENIP
        let statusEnviaENIP = await this.getENIPSocket().enviarENIP(layerENIP);

        retornoTag.msDetalhes.dateTimeFim = new Date().getTime();

        retornoTag.msDetalhes.totalMsLeitura = retornoTag.msDetalhes.dateTimeFim - retornoTag.msDetalhes.dateTimeInicio;

        // Analisar se o envio e o recebimento dos pacotes ENIPs obtiveram sucesso
        if (!statusEnviaENIP.isSucesso) {
            // Se deu erro ao processar o ENIP, verificar.

            // Se deu erro ao processar o ENIP, verificar.
            if (!statusEnviaENIP.enipEnviar.isEnviou) {

                if (statusEnviaENIP.enipEnviar.erro.isWriteSocket) {
                    // O erro foi causado na hora de usar o Write pra escrever no Socket
                    retornoTag.erro.enviarENIP.isWriteSocket = true;
                } else if (statusEnviaENIP.enipEnviar.erro.isGerarBuffer) {
                    // O erro foi causado na geração do Buffer do Builder do ENIP. Algum campo invalido provavelmente
                    retornoTag.erro.enviarENIP.isGerarBuffer = true;
                    retornoTag.erro.enviarENIP.gerarBuffer.traceLog = statusEnviaENIP.enipEnviar.erro.erroGerarBuffer.traceLog;
                }

                retornoTag.erro.descricao = `O envio do ENIP retornou: ${statusEnviaENIP.enipEnviar.erro.descricao}`;
                retornoTag.erro.isEnviarENIP = true;
                return retornoTag;
            }

            // Se deu erro ao receber o ENIP, verificar.
            if (!statusEnviaENIP.enipReceber.isRecebeu) {
                if (statusEnviaENIP.enipReceber.erro.isDemorouResposta) {
                    // O erro foi causado por demorar a resposta do pacote ENIP
                    retornoTag.erro.receberENIP.isDemorouResposta = true;
                }

                retornoTag.erro.descricao = `O recebimento do ENIP retornou: ${statusEnviaENIP.enipReceber.erro.descricao}`;
                retornoTag.erro.isReceberENIP = true;
                return retornoTag;
            }
        }

        // Se chegou aqui, eu tenho o pacote ENIP de resposta do controlador. Agora preciso verificar se ele retornou sucesso ou não na operação de leitura
        const ENIPResposta = statusEnviaENIP.enipReceber.enipParser;

        // Se o comando ENIP principal deu erro
        if (!ENIPResposta.isValido().isValido) {
            retornoTag.erro.descricao = `O pacote de resposta ENIP não é valido, alguma informação no Buffer está incorreta: ${ENIPResposta.isValido().erro.descricao}`;
            retornoTag.erro.isErroLayers = true;
            retornoTag.erro.erroLayers.isENIPInvalido = true;
            retornoTag.erro.erroLayers.ENIPInvalido.trace = ENIPResposta.isValido().tracer.getHistoricoOrdenado();
            return retornoTag;
        }

        // Se o ENIP for validado, verificar se ele retornou o estado de sucesso
        if (!ENIPResposta.isStatusSucesso().isSucesso) {
            retornoTag.erro.descricao = `O pacote de resposta ENIP retornou um status de erro: ${ENIPResposta.getStatus().codigo} - ${ENIPResposta.getStatus().mensagem}`;
            retornoTag.erro.ENIPStatusErro.codigo = ENIPResposta.getStatus().codigo;
            retornoTag.erro.ENIPStatusErro.mensagem = ENIPResposta.getStatus().mensagem;
            retornoTag.erro.isENIPStatusErro = true;
            return retornoTag;
        }

        // O comando que deve ser retornado é um SendRRData. Na teoria isso nunca deveria cair aqui pq a resposta do ENIP sempre deve corresponder a solicitação original, se enviou um SendRRData, deve receber um SendRRData
        if (!ENIPResposta.isSendRRData()) {
            retornoTag.erro.descricao = 'O pacote de resposta não é um SendRRData.';
            retornoTag.erro.isErroLayers = true;
            retornoTag.erro.erroLayers.isSendRRDataInvalido = true;

            return retornoTag;
        }

        // Obter as informações do SendRRData
        const ENIPSendRRData = ENIPResposta.getAsSendRRData();

        // Se retornou um SendRRData, validar se o parser conseguiu extrair as informações corretamente
        if (!ENIPSendRRData.isValido().isValido) {
            // Se não for valido, isso significa que deu algum erro em dar parse no Buffer recebido pro SendRRData

            retornoTag.erro.descricao = `O pacote SendRRData não é valido, alguma informação no Buffer está incorreta: ${ENIPSendRRData.isValido().erro.descricao}`;
            retornoTag.erro.isErroLayers = true;
            retornoTag.erro.erroLayers.isSendRRDataInvalido = true;
            retornoTag.erro.erroLayers.sendRRDataInvalido.trace = ENIPSendRRData.isValido().tracer.getHistoricoOrdenado();

            return retornoTag;
        }

        // Obrigatoriamente deve ser um serviço CIP que contém os dados encapsulados da informação de leitura da tag(já que a comunicação no momento com o Compact tá sendo via CIP)
        if (!ENIPSendRRData.isServicoCIP()) {
            retornoTag.erro.descricao = 'O pacote de resposta não contém um serviço CIP';

            retornoTag.erro.isErroLayers = true;
            retornoTag.erro.erroLayers.isCIPInvalido = true;

            return retornoTag;
        }

        // Obter as informações do Serviço CIP que contém nessa altura do jogo, o CIP Connection Manager com as informações solicitadas
        const ENIPCIP = ENIPSendRRData.getAsServicoCIP();
        if (!ENIPCIP.isValido().isValido) {

            retornoTag.erro.descricao = `O pacote CIP não é valido, alguma informação no Buffer está incorreta: ${ENIPCIP.isValido().erro.descricao}`;
            retornoTag.erro.isErroLayers = true;
            retornoTag.erro.erroLayers.isCIPInvalido = true;
            retornoTag.erro.erroLayers.CIPInvalido.trace = ENIPCIP.isValido().tracer.getHistoricoOrdenado();

            return retornoTag;
        }

        const CIPConnectionManager = ENIPCIP.getAsConnectionManager();
        if (!CIPConnectionManager.isValido().isValido) {

            retornoTag.erro.descricao = `O pacote CIP Connection Manager não é valido, alguma informação no Buffer está incorreta: ${CIPConnectionManager.isValido().erro.descricao}`;
            retornoTag.erro.isErroLayers = true;
            retornoTag.erro.erroLayers.isCIPInvalido = true;
            retornoTag.erro.erroLayers.CIPInvalido.trace = CIPConnectionManager.isValido().tracer.getHistoricoOrdenado();

            return retornoTag;
        }

        // Por último, o pacote CIP deve encapsular o Single Service Packet que foi a informação da tag requisitada

        if (!CIPConnectionManager.isSingleServicePacket()) {
            retornoTag.erro.descricao = 'O pacote de resposta não contém um Single Service Packet';

            retornoTag.erro.isErroLayers = true;
            retornoTag.erro.erroLayers.isSingleServicePacket = true;

            return retornoTag;
        }
        const ENIPSingleService = CIPConnectionManager.getAsSingleServicePacket();

        // Validar se é deu pra dar parse no Buffer sem erros.
        if (!ENIPSingleService.isValido().isValido) {

            retornoTag.erro.descricao = `O pacote Single Service Packet não é valido, alguma informação no Buffer está incorreta: ${ENIPSingleService.isValido().erro.descricao}`;
            retornoTag.erro.isErroLayers = true;
            retornoTag.erro.erroLayers.isSingleServicePacket = true;
            retornoTag.erro.erroLayers.singleServicePacket.trace = ENIPSingleService.isValido().tracer.getHistoricoOrdenado();

            return retornoTag;
        }

        let detalhesStatus = ENIPSingleService.isStatusSucesso();
        // Ok pronto! Se chegou aqui, todas as camadas do pacote ENIP foram processadas com sucesso. Analisar se a ação de leitura foi bem sucedida ou não
        if (!detalhesStatus.isSucesso) {

            retornoTag.erro.isStatusInvalido = true;
            retornoTag.erro.statusInvalido.codigoDeErro = detalhesStatus.erro.codigoStatus
            retornoTag.erro.statusInvalido.descricaoStatus = `${detalhesStatus.erro.descricaoStatus} - ${detalhesStatus.erro.descricao}`;

            switch (detalhesStatus.erro.codigoStatus) {
                // Se o status for Path Segment Error, significa que a tag não existe
                case CIPGeneralStatusCodes.PathSegmentError.hex: {
                    retornoTag.erro.descricao = 'A tag não existe.';
                    retornoTag.erro.statusInvalido.isTagNaoExiste = true;
                    break;
                }
                case CIPGeneralStatusCodes.PathDestinationUnknown.hex: {
                    retornoTag.erro.descricao = 'A tag existe, porém o index de array solicitado não existe.';
                    retornoTag.erro.statusInvalido.isIndexArrayNaoExiste = true;
                    break;
                }
                // Para qualquer outro erro
                default: {
                    retornoTag.erro.descricao = `O pacote Single Service Packet retornou um status de erro: ${ENIPSingleService.getStatus().codigoStatus} - ${ENIPSingleService.getStatus().descricaoStatus} `;

                    let bufferAdditionalStatus = ENIPSingleService.getStatus().additionalStatusCode.buffer;

                    // Se foi retornado o Additional Status 
                    if (bufferAdditionalStatus != undefined) {
                        retornoTag.erro.statusInvalido.additionalStatusCode = bufferAdditionalStatus;
                        let codigoErroExtra = bufferAdditionalStatus.readUInt16LE(0);

                        switch (codigoErroExtra) {
                            default:
                                retornoEscrita.erro.descricao += `/ Additional Status Code retornado: ${codigoErroExtra}`;
                                break;
                        }
                    }
                    break;
                }
            }
            return retornoTag;
        }

        // Converter o Buffer que contém as informações da tag lida
        let converteBufferPraValor = this.#converteDataTypeToValor(ENIPSingleService.getAsCIPClassCommandSpecificData());

        // Se não foi possível converter o valor
        if (!converteBufferPraValor.isConvertido) {

            retornoTag.erro.isConverterValor = true;
            retornoTag.erro.descricao = `Não foi possível converter o valor do Buffer: ${converteBufferPraValor.erro.descricao}`;
            return retornoTag;
        }

        // Finalmente, se tudo deu certo, estou com o valor em mãos
        if (converteBufferPraValor.conversao.isAtomico) {
            retornoTag.sucesso.tag.isAtomico = true;

            retornoTag.sucesso.tag.atomico.valor = converteBufferPraValor.conversao.atomico.valor;
            retornoTag.sucesso.tag.atomico.dataType = converteBufferPraValor.conversao.atomico.dataType;

        } else if (converteBufferPraValor.conversao.isStruct) {

            retornoTag.sucesso.tag.isStruct = true;

            retornoTag.sucesso.tag.struct.dataTypeStruct = converteBufferPraValor.conversao.struct.dataType;

            // Analisar o tipo da Struct e devolver corretamente no retorno
            if (converteBufferPraValor.conversao.struct.dataType.codigoTipoStruct == dataTypes.structs.ASCIISTRING82.codigoTipoStruct) {

                /**
                 * @type {DataTypeTagStructASCIIString82}
                 */
                let structTipoString = {
                    stringConteudo: converteBufferPraValor.conversao.struct.structData.stringConteudo,
                    tamanho: converteBufferPraValor.conversao.struct.structData.tamanho
                }
                retornoTag.sucesso.tag.struct.valor = structTipoString
            }
        } else {
            retornoTag.erro.descricao = 'O valor lido não é nem atomico nem uma struct';
            retornoTag.erro.isConverterValor = true;
            return retornoTag;
        }

        retornoTag.isSucesso = true;
        return retornoTag;
    }

    /**
     * Solicita multiplas tags para serem lidas
     * @param {Array<String>} tags - Array de tags a serem lidas
     */
    async lerMultiplasTags(tags) {
        if (tags == undefined) throw new Error('Tags a serem lidas não informadas');
        if (!Array.isArray(tags)) throw new Error('Tags a serem lidas devem ser um array');
        if (tags.length == 0) throw new Error('Array de tags a serem lidas não pode ser vazio');

        // Verificar se alguma tag do Array não é uma string
        if (tags.some(tag => typeof tag != 'string')) throw new Error('Todas as tags a serem lidas devem ser strings');

        const retornoLeituraMultipla = {
            /**
             * Se pelo menos a requisição de leitura chegou ao dispositivo remoto e retornou uma resposta(mesmo que seja uma resposta de erro)
             */
            isSucesso: false,
            /**
             * Se sucesso, contém os detalhes das tags lidas
             */
            sucesso: {
                /**
                 * @type {TagLidaMultipla[]}
                 */
                tags: []
            },
            /**
             * Se ocorreu algum erro durante a requisição.
             */
            erro: {
                descricao: '',
                /**
                 * Se o erro foi causado pelo recibo do pacote ENIP com erros no Buffer
                 */
                isENIPInvalido: false,
                /**
                 * Se isENIPInvalido, contém os detalhes do erro
                 */
                ENIPInvalido: {
                    /**
                     * Array de mensagens com o historico de cada etapa do processamento do Buffer, conterá onde ocorreu o erro no Buffer
                     */
                    trace: []
                },
                /**
                 * Se o erro foi causado devido ao status de retorno do pacote ENIP diferente de Sucesso.
                 */
                isENIPStatusErro: false,
                /**
                 * Se isENIPStatusErro, contém os detalhes do erro
                 */
                ENIPStatusErro: {
                    /**
                     * Código de identificação do erro
                     */
                    codigo: '',
                    /**
                     * Descrição da identificação do erro
                     */
                    descricao: ''
                }
            }
        }

        const layerENIP = this.getENIPSocket().getNovoLayerBuilder();

        // O Connection Manager é o primeiro layer que deve ser enviado
        const layerConnectionManager = layerENIP.buildSendRRData().criarServicoCIP().buildCIPConnectionManager();

        // Adicionar o Multiple Service Packet que é o pacote que contém as informações de leitura de multiplas tags
        const layerMultipleService = layerConnectionManager.getCIPMessage().buildMultipleServicePacket();
        layerMultipleService.setAsMessageRouter();

        // Maximo de bytes que podem ser enviados em um pacote ENIP
        const maximoBytes = 512;

        // Se o pacote ENIP atual ultrapassou o limite de bytes
        let isAtingiuLimiteTags = false;

        // Array de tags que ultrapassaram o limite de bytes e que serão enviados em um novo ENIP
        const tagsUltrapassaramLimite = [];

        // Array de todas as tags em sequencia ordenada que foram enviadas no pacote ENIP
        const tagsEmSequencia = [];

        // Ordenar as tags pelo menor ao maior tamanho. É importante que esteja ordenado pois a resposta do dispositivo também retorna a mesma sequencia de tags(e como ele não retorna na resposta o nome da tag, o index do serviço é a unica forma de reconhecer)
        // Se não ordenar, pode acabar pulando uma tag grande na sequencia que não caberia, porém a proxima cabe, o que resulta no meu array ser a sequencia A, B, C(digamos que esse era a tag grande que nao cabe), D(e essa pequena cabe) e na resposta eu receber A, B, D.
        for (const tag of tags.sort((a, b) => a.length - b.length)) {

            // Se a tag já foi adicionado, não permito adicionar novamente
            if (layerMultipleService.getServicesPackets().find(servicePacket => servicePacket.servico.getStringPath() == tag) != undefined) continue;

            // Adicionar a tag ao array de tags solicitadas(mesmo que não caiba, eu adiciono pra mais pra frente eu ja ter o array completo de todas as tags solicitadas, tenham elas sido enviadas nesse pacote ENIP ou em outro..)
            tagsEmSequencia.push(tag);

            // Se já atingiu o limite vou pular, pois como o array foi ordenado crescente, eu sei que as próximas tags também não vão caber nesse ENIP. Assim evito ficar gerando Buffer de forma desnecessária.
            if (isAtingiuLimiteTags) {
                tagsUltrapassaramLimite.push(tag);
                continue;
            }

            // Adiciona um Single Service ao Multiple Service
            let layerSingleService = layerMultipleService.addSingleServicePacket();

            // Validar se o usuario informou uma tag de array dimensinal (verificar se existe o [] e o index dentro)
            let isArrayIndex = tag.match(/\[\d+\]/g);

            // Se contiver o index do numero
            if (isArrayIndex) {

                // Cortar somente o nome da tag sem os []
                let nomeTagCortadad = tag.split('[')[0];
                let indexSolicitado = parseInt(isArrayIndex[0].replace('[', '').replace(']', ''));

                // Para leituras de tags que correspondem a localização de um array, devo incluir o Member Request Path que inclua qual o membro(index do array no CompactLogix)
                layerSingleService.servico.setAsGetAttribute({
                    nome: `${nomeTagCortadad}`,
                    CIPGenericBuffer: Buffer.from([0x01, 0x00]),
                    MemberRequestPath: Buffer.from([0x28, indexSolicitado])
                })
            } else {
                // Pra ler uma tag pelo menos no CompactLogix, o CIP Generic data deve ser só o Request Path pra string da tag, e o CIP Class Generic é só um array vazio já que não precisa enviar informações
                layerSingleService.servico.setAsGetAttribute({
                    nome: `${tag}`,
                    CIPGenericBuffer: Buffer.from([0x01, 0x00])
                })
            }

            let bufferENIP = layerENIP.criarBuffer();
            if (!bufferENIP.isSucesso) {

                retornoLeituraMultipla.erro.descricao = `Erro ao verificar tamanho do Buffer para o Single Service Pack da tag ${tag}: ${bufferENIP.erro.descricao}`;
                return retornoLeituraMultipla;
            }

            // Veficiar se não ultrapassou o limite de bytes
            if (bufferENIP.sucesso.buffer.length >= maximoBytes) {

                // Se ultrapassou o limite de bytes, remover o Single Service Packet que foi adicionado
                layerMultipleService.deleteSingleServicePacket(layerSingleService.id);

                // Adicionar a lista de tags que ultrapassaram o limite
                tagsUltrapassaramLimite.push(tag);

                // Seta pras próximas tags não serem adicionadas a esse ENIP
                isAtingiuLimiteTags = true;
            }
        }

        // Ok, adicionar os layers, tentar enviar o ENIP

        const statusEnviaENIP = await this.getENIPSocket().enviarENIP(layerENIP);

        // Se ocorreu algum tipo de erro durante o envio ou rcebimento do ENIP
        if (!statusEnviaENIP.isSucesso) {

            // Se o erro foi devido ao envio do ENIP
            if (!statusEnviaENIP.enipEnviar.isEnviou) {

                retornoLeituraMultipla.erro.descricao = `Erro ao enviar o pacote ENIP: ${statusEnviaENIP.enipEnviar.erro.descricao}`;
                return retornoLeituraMultipla;
            }

            // Se o erro foi devido ao não recebimento da resposta da solicitação ENIP
            if (!statusEnviaENIP.enipReceber.isRecebeu) {

                retornoLeituraMultipla.erro.descricao = `Erro ao receber o pacote ENIP: ${statusEnviaENIP.enipReceber.erro.descricao}`;
                return retornoLeituraMultipla;
            }
        }

        // Se chegou aqui, o pacote ENIP foi enviado e recebido com sucesso. Agora é analisar o conteúdo da resposta nos próximos layers
        const ENIPResposta = statusEnviaENIP.enipReceber.enipParser;

        // Se o pacote ENIP não é valido
        if (!ENIPResposta.isValido().isValido) {
            retornoLeituraMultipla.erro.descricao = `O pacote de resposta ENIP não é valido, alguma informação no Buffer está incorreta: ${ENIPResposta.isValido().erro.descricao}`;

            retornoLeituraMultipla.erro.isENIPInvalido = true;
            retornoLeituraMultipla.erro.ENIPInvalido.trace = ENIPResposta.isValido().tracer.getHistoricoOrdenado();

            return retornoLeituraMultipla;
        }

        // Ok, se o pacote ENIP for valido, verificar o status retornou Sucesso
        if (!ENIPResposta.isStatusSucesso().isSucesso) {
            retornoLeituraMultipla.erro.descricao = `O pacote de resposta ENIP retornou um status de erro: ${ENIPResposta.getStatus().codigo} - ${ENIPResposta.getStatus().mensagem}`;

            retornoLeituraMultipla.erro.isENIPStatusErro = true;
            retornoLeituraMultipla.erro.ENIPStatusErro.codigo = ENIPResposta.getStatus().codigo;
            retornoLeituraMultipla.erro.ENIPStatusErro.descricao = ENIPResposta.getStatus().mensagem;

            return retornoLeituraMultipla;
        }

        // O comando da resposta deve ser um SendRRData
        if (!ENIPResposta.isSendRRData()) {
            retornoLeituraMultipla.erro.descricao = 'O pacote de resposta não é um SendRRData';

            return retornoLeituraMultipla;
        }

        // Obter as informações do SendRRData
        const ENIPSendRRData = ENIPResposta.getAsSendRRData();

        // Validar se o parser conseguiu extrair as informações corretamente
        if (!ENIPSendRRData.isValido().isValido) {
            retornoLeituraMultipla.erro.descricao = `O pacote SendRRData não é valido, alguma informação no Buffer está incorreta: ${ENIPSendRRData.isValido().erro.descricao}`;

            return retornoLeituraMultipla;
        }

        // Obrigatoriamente deve ser um serviço CIP que contém os dados encapsulados da informação de leitura da tag(já que a comunicação no momento com o Compact tá sendo via CIP)
        if (!ENIPSendRRData.isServicoCIP()) {
            retornoLeituraMultipla.erro.descricao = 'O pacote de resposta não contém um serviço CIP';

            return retornoLeituraMultipla;
        }

        // Obter as informações do Serviço CIP que contém nessa altura do jogo, o CIP Connection Manager com as informações solicitadas
        const ENIPCIP = ENIPSendRRData.getAsServicoCIP();

        if (!ENIPCIP.isValido().isValido) {
            retornoLeituraMultipla.erro.descricao = `O pacote CIP não é valido, alguma informação no Buffer está incorreta: ${ENIPCIP.isValido().erro.descricao}`;

            return retornoLeituraMultipla;
        }

        // Validar o código de status do CIP, pois tem alguns status que são erros fatais e não tem como prosseguir
        if (ENIPCIP.getStatusCIP().codigo != CIPGeneralStatusCodes.Success.hex) {

            /**
             * Se o erro retornado é fatal e não da pra continuar a função de leitura das tags
             */
            let isErroFatal = false;

            switch (ENIPCIP.getStatusCIP().codigo) {
                // O unico erro que permite continuar a leitura das tags é o Path Segment Error, que é um erro de caminho da tag, e como nesse caso são Multiple Service, uma pode ter dado erro porém outras não
                case CIPGeneralStatusCodes.PathSegmentError.hex: {
                    break
                }
                /**
                 * Alguns dos serviços solicitados no CIP embeded deu erro, porém permito continuar pois pode haver outras que deram certo
                 */
                case CIPGeneralStatusCodes.EmbeddedServiceError.hex: {

                    break;
                }
                // Pra qualquer outro tipo de erro, eu não permito continuar
                default: {

                    retornoLeituraMultipla.erro.descricao = `O pacote CIP retornou um status de erro: ${ENIPCIP.getStatusCIP().codigo} - ${ENIPCIP.getStatusCIP().descricao}`;
                    isErroFatal = true;
                    break;
                }
            }

            if (isErroFatal) {
                return retornoLeituraMultipla;
            }
        }

        // Esperado que o conteudo do CIP seja uma resposta de uma solicitação Connection Manager
        const CIPConnectionManager = ENIPCIP.getAsConnectionManager();
        if (!CIPConnectionManager.isValido().isValido) {
            retornoLeituraMultipla.erro.descricao = `O pacote CIP Connection Manager não é valido, alguma informação no Buffer está incorreta: ${CIPConnectionManager.isValido().erro.descricao}`;

            return retornoLeituraMultipla
        }

        // Ok, validado o código de status do CIP, agora devo ter um Multiple Service Packet encapsulado com os dados de cada Single Service

        if (!CIPConnectionManager.isMultipleServicePacket()) {
            retornoLeituraMultipla.erro.descricao = 'O pacote de resposta não contém um Multiple Service Packet';

            return retornoLeituraMultipla;
        }

        // Obter o Multiple Service Packet com as informações dos serviços solicitados
        const ENIPMultipleService = CIPConnectionManager.getAsMultipleServicePacket();
        if (!ENIPMultipleService.isValido().isValido) {
            retornoLeituraMultipla.erro.descricao = `O pacote Multiple Service Packet não é valido, alguma informação no Buffer está incorreta: ${ENIPMultipleService.isValido().erro.descricao}`;

            return retornoLeituraMultipla;
        }

        /**
         * @typedef TagLidaMultipla
         * @property {String} tag - Tag lida
         * @property {Boolean} isSucesso - Se a leitura da tag foi bem sucedida
         * @property {Object} sucesso - Se isSucesso for true, contém os detalhes da tag lida
         * @property {Boolean} sucesso.isAtomico - Se o valor lido é atomico(numeros DataType de 193 a 202)
         * @property {Object} sucesso.atomico - Se isAtomico for true, contém os detalhes do valor lido
         * @property {Number} sucesso.atomico.valor - O valor númerico
         * @property {DataTypeTagAtomico} sucesso.atomico.dataType - O DataType do valor lido
         * @property {Boolean} sucesso.isStruct - Se o valor lido é do tipo de uma Struct
         * @property {Object} sucesso.struct - Se isStruct for true, contém os detalhes da Struct
         * @property {DataTypeTagStruct} sucesso.struct.dataTypeStruct - O Data Type da Struct lido
         * @property {DataTypeTagStructASCIIString82} sucesso.struct.valor - O valor da Struct lido. Esse campo é dinamico depenendo do tipo da Struct
         * @property {Object} erro - Se isSucesso for false, contém os detalhes do erro ocorrido
         * @property {String} erro.descricao - Descrição do erro ocorrido
         * @property {Boolean} erro.isCIPNaoRetornado - A resposta ENIP recebida não continha um CIP com os dados dessa tag solicitada
         * @property {Boolean} erro.isCIPInvalido - O CIP Packet retornado não é valido
         * @property {Object} erro.CIPInvalido - Se isCIPInvalido, contém o motivo de ser invalido
         * @property {Array<String>} erro.CIPInvalido.trace - Trace de cada etapa do processamento do Buffer do CIP, deve ter onde ocorreu o erro de CIP invalido
         * @property {Boolean} erro.isSingleServicePacketNaoRetornado - A resposta ENIP recebida não continha um Single Service Packet com os dados dessa tag solicitada
         * @property {Boolean} erro.isSingleServicePacketInvalido - O Single Service Packet retornado tem algo erro no Buffer e não é valido
         * @property {Object} erro.singleServicePacketInvalido - Se isSingleServicePacketInvalido, contém o motivo de ser invalido
         * @property {Array<String>} erro.singleServicePacketInvalido.trace - Trace de cada etapa do processamento do Buffer do Single Service Packet, deve ter onde ocorreu o erro de Single Service Packet invalido
         * @property {Boolean} erro.isConverteValor - O valor recebido não foi possivel converter para o valor real da tag
         * @property {Boolean} erro.isSingleServicePacketStatusErro - O Single Service Packet retornou um status de erro
         * @property {Object} erro.singleServicePacketStatusErro - Se isSingleServicePacketStatusErro, contém o motivo do erro de status
         * @property {Number} erro.singleServicePacketStatusErro.codigo - O código de status retornado
         * @property {String} erro.singleServicePacketStatusErro.descricao - A descrição do status retornado 
         * @property {Boolean} erro.singleServicePacketStatusErro.isTagNaoExiste - Se o status retornado foi de Path Segment Error, significa que a tag não existe
         * @property {Boolean} erro.singleServicePacketStatusErro.isIndexArrayNaoExiste - Se o status retornado foi de Path Destination Unknown, significa que a tag existe, porém o index do array solicitado não existe
         */

        /**
         * @type {TagLidaMultipla[]}
         */
        const tagsLidas = [];

        // Iterar sobre as tags solicitadas para verificar se todas foram retornadas na resposta ENIP. Essa ordem do array deve ser exatamente como foi enviada no pacote ENIP
        for (const tag of tagsEmSequencia) {

            /**
             * @type {TagLidaMultipla}
             */
            let novoObjData = {
                tag: tag,
                isSucesso: false,
                sucesso: {
                    isAtomico: false,
                    atomico: {
                        dataType: undefined,
                        valor: undefined
                    },
                    isStruct: false,
                    struct: {
                        dataTypeStruct: undefined,
                        valor: undefined
                    }
                },
                erro: {
                    descricao: 'Não foi retornado informações dessa tag na resposta ENIP.',
                    isCIPNaoRetornado: true,
                    isCIPInvalido: false,
                    CIPInvalido: {
                        trace: []
                    },
                    isSingleServicePacketNaoRetornado: false,
                    isSingleServicePacketInvalido: false,
                    singleServicePacketInvalido: {
                        trace: []
                    },
                    isConverteValor: false,
                    isSingleServicePacketStatusErro: false,
                    singleServicePacketStatusErro: {
                        codigo: undefined,
                        descricao: '',
                        isIndexArrayNaoExiste: false,
                        isTagNaoExiste: false
                    }
                }
            }

            if (tagsLidas.find(tagObj => tagObj.tag == novoObjData.tag) != undefined) continue

            tagsLidas.push(novoObjData);
        }

        /**
         * Leituras de tags que foram consideradas parciais e precisam ser lidas novamente em outra solicitação
         * @type {Array[]}
         */
        let tagsPartialTransfer = []

        // Se chegou aqui, o Multiple Service Packet foi processado com sucesso. Agora devo iterar sobre os CIPs packets retornados para obter os valores de cada tag solicitada
        // Um detalhe é que, a resposta de solicitação não retorna o nome da tag solicitada, apenas o seu buffer com tipo do dado e valor, então preciso iterar em ordem que foi buildado no ENIP, que é só o for of nas tags solicitadas
        for (let indexServiceCIP = 0; indexServiceCIP < ENIPMultipleService.getServicesPackets().length; indexServiceCIP++) {

            const CIPPacket = ENIPMultipleService.getServicesPackets()[indexServiceCIP];
            const possivelTagSolicitada = tagsLidas[indexServiceCIP];


            // Na teoria não deveria estar como undefined, mas né
            if (possivelTagSolicitada == undefined) {
                continue;
            } else {
                // Se achou, reseta a mensagem de não encontrado
                possivelTagSolicitada.erro.isCIPNaoRetornado = false;
                possivelTagSolicitada.erro.descricao = ''
            }


            // Validar se o Single Service Packet é valido
            if (!CIPPacket.isValido().isValido) {
                possivelTagSolicitada.erro.descricao = `O pacote CIP não é valido, alguma informação no Buffer está incorreta: ${CIPPacket.isValido().erro.descricao}`;
                possivelTagSolicitada.erro.isCIPInvalido = true;
                possivelTagSolicitada.erro.CIPInvalido.trace = CIPPacket.isValido().tracer.getHistoricoOrdenado();
                continue;
            }

            // O Single Service Packet é contido dentro do Connection Manager
            const CIPConnectionManager = CIPPacket.getAsConnectionManager();
            if (!CIPConnectionManager.isValido().isValido) {
                possivelTagSolicitada.erro.descricao = `O pacote CIP Connection Manager não é valido, alguma informação no Buffer está incorreta: ${CIPConnectionManager.isValido().erro.descricao}`;
                possivelTagSolicitada.erro.isCIPInvalido = true;
                possivelTagSolicitada.erro.CIPInvalido.trace = CIPConnectionManager.isValido().tracer.getHistoricoOrdenado();
                continue;
            }

            // É pra ser um Single Service Packet com os dados da tag lida
            if (!CIPConnectionManager.isSingleServicePacket()) {

                possivelTagSolicitada.erro.descricao = 'O pacote de resposta não contém um Single Service Packet';
                possivelTagSolicitada.erro.isSingleServicePacketNaoRetornado = true;
                continue;
            }

            // Se for valido e for um Single Service Packet, analisar as informações da tag lida
            const singleServicePacket = CIPConnectionManager.getAsSingleServicePacket();

            // Validar se o Buffer do Single Service Packet é valido
            if (!singleServicePacket.isValido().isValido) {

                possivelTagSolicitada.erro.descricao = `O pacote Single Service Packet não é valido, alguma informação no Buffer está incorreta: ${singleServicePacket.isValido().erro.descricao}`;
                possivelTagSolicitada.erro.isSingleServicePacketInvalido = true;
                possivelTagSolicitada.erro.singleServicePacketInvalido.trace = singleServicePacket.isValido().tracer.getHistoricoOrdenado();
                continue;
            }

            // Se o buffer é valido, validar o status retornado do service packet
            if (!singleServicePacket.isStatusSucesso().isSucesso) {

                possivelTagSolicitada.erro.isSingleServicePacketStatusErro = true;
                possivelTagSolicitada.erro.singleServicePacketStatusErro.codigo = singleServicePacket.getStatus().codigoStatus;
                possivelTagSolicitada.erro.singleServicePacketStatusErro.descricao = singleServicePacket.getStatus().descricaoStatus;

                // Foi retornado algum erro pra esse service packet, validar o tipo do erro
                switch (singleServicePacket.getStatus().codigoStatus) {
                    // Se for um partial transfer, preciso colocar essa tag pra ler de novo pois não coube na requisição a leitura dela
                    case CIPGeneralStatusCodes.PartialTransfer.hex: {
                        tagsPartialTransfer.push(possivelTagSolicitada.tag);
                        continue;
                    }
                    case CIPGeneralStatusCodes.PathSegmentError.hex: {
                        possivelTagSolicitada.erro.descricao = 'A tag não existe.';
                        possivelTagSolicitada.erro.singleServicePacketStatusErro.isTagNaoExiste = true;
                        continue;
                    }
                    case CIPGeneralStatusCodes.PathDestinationUnknown.hex: {
                        possivelTagSolicitada.erro.descricao = 'A tag existe, porém o index de array solicitado não existe.';
                        possivelTagSolicitada.erro.singleServicePacketStatusErro.isIndexArrayNaoExiste = true;
                        continue;
                    }
                    default: {
                        possivelTagSolicitada.erro.descricao = `O pacote Single Service Packet retornou um status de erro: ${singleServicePacket.getStatus().descricaoStatus}`;
                        continue;
                    }
                }
            }

            // Se todas as verificaçoes acima fecharem, o Single Service Packet é valido e posso obter o valor da tag lida
            const CIPDataGeneric = singleServicePacket.getAsCIPClassCommandSpecificData();

            // Converter o Buffer que contém os dados da tag lida
            const converteBufferTag = this.#converteDataTypeToValor(CIPDataGeneric);
            if (converteBufferTag.isConvertido) {

                if (converteBufferTag.conversao.isAtomico) {
                    possivelTagSolicitada.isSucesso = true;
                    possivelTagSolicitada.sucesso.isAtomico = true;
                    possivelTagSolicitada.sucesso.atomico.valor = converteBufferTag.conversao.atomico.valor;
                    possivelTagSolicitada.sucesso.atomico.dataType = converteBufferTag.conversao.atomico.dataType;
                } else if (converteBufferTag.conversao.isStruct) {
                    possivelTagSolicitada.isSucesso = true;
                    possivelTagSolicitada.sucesso.isStruct = true;
                    possivelTagSolicitada.sucesso.struct.dataTypeStruct = converteBufferTag.conversao.struct.dataType;
                    possivelTagSolicitada.sucesso.struct.valor = converteBufferTag.conversao.struct.structData;
                }
            } else {
                // Se ocorreu algum erro pra converter

                possivelTagSolicitada.erro.descricao = `Não foi possível converter o valor do Buffer: ${converteBufferTag.erro.descricao}`;
                possivelTagSolicitada.erro.isConverteValor = true;
            }
        }

        // Se houveram tags que precisam ser lidas novamente, fazer a leitura delas
        if (tagsPartialTransfer.length > 0) {

            // Isso causará um efeito em cascata para leituras de novas tags se as chamadas subsequentes precisarem dividir as leituras em mais chamados, e ta tudo bem!
            let leituraTagsPartialTransfer = await this.lerMultiplasTags(tagsPartialTransfer);

            // Se não foi possível obter uma resposta enviar ou receber a resposta ENIP do dispositivo
            if (!leituraTagsPartialTransfer.isSucesso) {

                // Pegar as tags que foram solicitadas e anotar o motivo do erro
                for (const tagSolicitada of tagsPartialTransfer) {
                    const tagObjDetalhes = tagsLidas.find(tag => tag.tag == tagSolicitada);

                    if (tagObjDetalhes == undefined) continue;

                    // Anotar o erro de sem respsota
                    tagObjDetalhes.erro.descricao = `Erro ao solicitar a leitura da tag ${tagSolicitada}: ${leituraTagsPartialTransfer.erro.descricao}`;
                    tagObjDetalhes.erro.isCIPNaoRetornado = true;
                }
            }

            // Ok, se a leitura dos partials deu certo, significa que pelo menos algum dos serviços solicitados foi lido com sucesso. 

            // Analisar cada tag lida
            for (const tagLida of leituraTagsPartialTransfer.sucesso.tags) {

                let tagObjDetalhes = tagsLidas.find(tag => tag.tag == tagLida.tag);
                if (tagObjDetalhes == undefined) continue;

                Object.assign(tagObjDetalhes, tagLida);
            }

        }

        // Se houverem tags que ultrapassaram o limite de bytes, fazer a leitura delas também.
        if (tagsUltrapassaramLimite.length > 0) {

            // Isso causará um efeito em cascata para leituras de novas tags se as chamadas subsequentes precisarem dividir as leituras em mais chamados, e ta tudo bem!
            let leiturasTagsUltrapassaramLimite = await this.lerMultiplasTags(tagsUltrapassaramLimite);

            // Se não foi possível obter uma resposta enviar ou receber a resposta ENIP do dispositivo
            if (!leiturasTagsUltrapassaramLimite.isSucesso) {

                // Pegar as tags que foram solicitadas e anotar o motivo do erro
                for (const tagSolicitada of tagsUltrapassaramLimite) {
                    const tagObjDetalhes = tagsLidas.find(tag => tag.tag == tagSolicitada);

                    if (tagObjDetalhes == undefined) continue;

                    // Anotar o erro de sem respsota
                    tagObjDetalhes.erro.descricao = `Erro ao solicitar a leitura da tag ${tagSolicitada}: ${leiturasTagsUltrapassaramLimite.erro.descricao}`;
                    tagObjDetalhes.erro.isCIPNaoRetornado = true;
                }
            } else {

                // Ok, se a leitura dos partials deu certo, significa que pelo menos algum dos serviços solicitados foi lido com sucesso.

                // Analisar cada tag lida
                for (const tagLida of leiturasTagsUltrapassaramLimite.sucesso.tags) {

                    let tagObjDetalhes = tagsLidas.find(tag => tag.tag == tagLida.tag);
                    if (tagObjDetalhes == undefined) continue;

                    Object.assign(tagObjDetalhes, tagLida);
                }
            }
        }

        // Ok, após validar cada tag lida, posso retornar

        retornoLeituraMultipla.isSucesso = true;
        retornoLeituraMultipla.sucesso.tags = tagsLidas;

        return retornoLeituraMultipla;
    }

    /**
     * @typedef EscreveTagStructASCIIString82
     * @property {String} string - String a ser escrita
     */

    /**
     * Realizar a escrita de uma unica tag do CompactLogix
     * @param {String} tag - Tag a ser escrita
     * @param {Object} dataType - Data Type da tag para escrever
     * @param {Boolean} dataType.isResolverAutomaticamente - Se deve resolver automaticamente o tipo de Data Type da tag
     * @param {Object} dataType.resolverAutomaticamente - Se isResolverAutomaticamente for true, contém os detalhes para resolver automaticamente o tipo de Data Type da tag
     * @param {Number} dataType.resolverAutomaticamente.valor - Valor a ser escrito para resolver automaticamente o tipo de Data Type
     * @param {Boolean} dataType.isAtomico - Se o Data Type é atomico ou não
     * @param {Object} dataType.atomico - Se atomico, contém os detalhes do valor a ser escrito
     * @param {Number} dataType.atomico.codigoAtomico - Código do tipo de Data Type a ser escrito
     * @param {Number} dataType.atomico.valor - Valor a ser escrito
     * @param {Boolean} dataType.isStruct - Se o Data Type é uma Struct ou não
     * @param {Object} dataType.struct - Se for uma Struct, contém os detalhes do valor a ser escrito
     * @param {Number} dataType.struct.codigoStruct - Código do tipo de Struct a ser escrita
     * @param {EscreveTagStructASCIIString82} dataType.struct.classeStruct - Classe da Struct a ser escrita(ASCIIString82, Timer, etc..)
     */
    async escreveTag(tag, dataType) {

        if (tag == undefined) throw new Error('Tag a ser escrita não informada');
        if (typeof tag != 'string') throw new Error('Tag a ser escrita deve ser uma string');
        if (tag == '') throw new Error('Tag a ser escrita não pode ser vazia');

        if (dataType == undefined) throw new Error('Data Type da tag a ser escrita não informado');
        if (typeof dataType != 'object') throw new Error('Data Type da tag a ser escrita deve ser um objeto');

        const retornoEscrita = {
            /**
             * Se a operação de escrita foi bem sucedida.
             */
            isSucesso: false,
            msDetalhes: {
                /**
                 * Data atual em millisegundos de quando a escrita foi iniciada e o pacote ENIP foi enviada
                 * @type {Number}
                 */
                dateTimeInicio: new Date().getTime(),
                /**
                 * Data atual em millisegundos de quando o pacote ENIP foi recebido e parseado
                 * @type {Number}
                 */
                dateTimeFim: undefined,
                /**
                 * Tempo em ms total de escrita da tag
                 */
                totalMsEscrita: undefined
            },
            /**
             * Se sucesso, contém os detalhes da tag escrita
             */
            sucesso: {
                tag: {
                    /**
                     * Se o valor escrito é atomico(numeros DataType de 193 a 202)
                     */
                    isAtomico: false,
                    /**
                     * Se isAtomico, contém os detalhes do valor escrito
                     */
                    atomico: {
                        /**
                         * O valor númerico
                         */
                        valor: undefined,
                        /**
                         * O DataType do valor lido
                         * @type {DataTypeTagAtomico}
                         */
                        dataType: undefined
                    },
                    /**
                     * Se o valor escrito é do tipo de uma Struct
                     */
                    isStruct: false,
                    /**
                     * Se Struct, contém os detalhes da Struct
                     */
                    struct: {
                        /**
                         * O Data Type da Struct lido
                         * @type {DataTypeTagStruct}
                         */
                        dataTypeStruct: undefined,
                        /**
                         * O valor da Struct escrito. Esse campo é dinamico depenendo do tipo da Struct
                         * @type {EscreveTagStructASCIIString82}
                         */
                        valor: undefined
                    }
                },
            },
            /**
             * Se não sucesso, contém todos os detalhes do erro do ocorrido
             */
            erro: {
                descricao: '',
                /**
                 * Se deu erro ao enviar o pacote ENIP
                 */
                isEnviarENIP: false,
                /**
                 * Se o erro foi causado devido a falha ao enviar o pacote ENIP, contém os detalhes extras desse erro
                */
                enviarENIP: {
                    /**
                     * Se foi erro ao escrever o pacote ENIP no socket
                     */
                    isWriteSocket: false,
                    /**
                     * Se foi erro ao gerar o buffer do pacote ENIP
                     */
                    isGerarBuffer: false,
                    /**
                     * Detalhes do erro ao gerar o Buffer do pacote ENIP se isGerarBuffer for true
                     */
                    gerarBuffer: {
                        /**
                         * Histórico de logs do erro ao gerar o Buffer do pacote ENIP
                         */
                        traceLog: []
                    }
                },
                /**
                 * Se deu erro ao receber o pacote ENIP
                 */
                isReceberENIP: false,
                /**
                 * Se o erro foi causado devido a falha ao receber o pacote ENIP, contém os detalhes extras desse erro. Esse erro só verifica pelo campo principal ENIP, os layers encapsulados posteriormente podem ter erros próprios,
                 * porém a garantia aqui é que o pacote ENIP foi recebido com sucesso
                */
                receberENIP: {
                    /**
                     * Se foi erro ao receber o pacote ENIP
                     */
                    isDemorouResposta: false
                },
                /**
                 * Se o pacote ENIP recebido não é valido
                 */
                isENIPInvalido: false,
                /**
                 * Se isENIPInvalido, contém os detalhes do erro do pacote ENIP
                 */
                ENIPInvalido: {
                    /**
                     * Trace de cada etapa do processamento do Buffer do pacote ENIP, conterá onde ocorreu o erro no Buffer
                     */
                    trace: []
                },
                /**
                 * Se o pacote ENIP retornou um status de erro
                 */
                isENIPStatusErro: false,
                /**
                 * Se isENIPStatusErro, contém os detalhes do status invalido
                 */
                ENIPStatusErro: {
                    /**
                     * Código do erro recebido
                     */
                    codigo: undefined,
                    /**
                     * Descrição do erro
                     */
                    descricao: ''
                },
                /**
                 * Se o erro foi causado devido a um erro de status, ou seja os layers estão todos em conformidade, porém o dispositivo retornou um status diferente de sucesso para a operação de leitura da tag
                 */
                isStatusInvalido: false,
                /**
                 * Se o erro ocorrido foi devido a tentativa de busca do Data Type de forma automatica
                 */
                isObterDataTypeAutomatico: false,
                /**
                 * Se isStatusInvalido, contém os detalhes do status invalido
                 */
                statusInvalido: {
                    /**
                     * A descrição basica do erro original ocorrido
                     */
                    descricaoStatus: '',
                    /**
                     * Código do erro recebido conforme CIP Response Codes
                     */
                    codigoDeErro: undefined,
                    /**
                     * Opcionalmente um Buffer com informações adicionais do erro se disponivel. Geralmente se o codigo principal é sucesso, additional status não tem nada de útil
                     */
                    additionalStatus: undefined,
                    /**
                     * O erro retornado corresponde ao da tag não existir
                     */
                    isTagNaoExiste: false,
                    /**
                     * O Data Type informado da tag não é valido.
                     */
                    isDataTypeIncorreto: false
                },
                /**
                 * Se o valor informado para escrever não é valido
                 */
                isTipoValorInvalido: false,
                /**
                 * O Data Type informado é inexistente
                 */
                isTipoDataTypeInexistente: false,
                /**
                 * Se o erro ocorrido foi devido a algum dos layers do pacote ENIP recebido estarem incorretos. É somente para erros de parse dos Buffers recebidos e suas camadas e garantir que os bytes recebidos estão em conformidade. Por exemplo
                 * se foi requisitado escrever uma tag que não existe, o controlador vai responder com um status de invalido no SingleServicePacket, então não caira em tratativas dos erros, e sim de status.
                 */
                isErroLayers: false,
                /**
                 * Se isErroLayers, contém qual layer ocorreu o erro
                 */
                erroLayers: {
                    /**
                     * Se o layer do SendRRData é valido
                     */
                    isSendRRDataInvalido: false,
                    /**
                     * Se o erro foi causado por falha ao processar o Buffer SendRRData
                     */
                    sendRRDataInvalido: {
                        /**
                         * Array de mensagens com o historico de cada etapa do processamento do Buffer, conterá onde ocorreu o erro no Buffer
                         */
                        trace: []
                    },
                    /**
                     * Se o layer do CIP é valido
                     */
                    isCIPInvalido: false,
                    /**
                     * Se o erro foi causado por falha ao processar o Buffer CIP
                     */
                    CIPInvalido: {
                        /**
                         * Array de mensagens com o historico de cada etapa do processamento do Buffer, conterá onde ocorreu o erro no Buffer
                         */
                        trace: []
                    },
                    /**
                     * Se o layer Single Service Packet é valido
                     */
                    isSingleServicePacket: false,
                    /**
                     * Se o erro foi causado por falha ao processar o Buffer Single Service Packet
                     */
                    singleServicePacket: {
                        /**
                         * Array de mensagens com o historico de cada etapa do processamento do Buffer, conterá onde ocorreu o erro no Buffer
                         */
                        trace: []
                    },
                },
            }
        }

        const layerENIP = this.getENIPSocket().getNovoLayerBuilder();
        const layerConnectionManager = layerENIP.buildSendRRData().criarServicoCIP().buildCIPConnectionManager();

        // O Single Service Packet eu configuro a tag solicitada e o valor a ser escrito
        const layerServicePacket = layerConnectionManager.getCIPMessage().buildSingleServicePacket();

        // Se o Data Type da tag a ser escrita é para ser resolvido automaticamente
        if (dataType.isResolverAutomaticamente) {

            const solicitaLeituraTag = await this.lerTag(tag);
            if (!solicitaLeituraTag.isSucesso) {

                retornoEscrita.erro.descricao = `Erro ao tentar resolver automaticamente o Data Type da tag ${tag}: ${solicitaLeituraTag.erro.descricao}`;
                retornoEscrita.erro.isObterDataTypeAutomatico = true;
                return retornoEscrita;
            }

            // Se resolveu, validar o tipo retornado e salvar no data type

            if (solicitaLeituraTag.sucesso.tag.isAtomico) {

                dataType.isAtomico = true;
                dataType.atomico = {
                    codigoAtomico: solicitaLeituraTag.sucesso.tag.atomico.dataType.codigo,
                    valor: dataType.resolverAutomaticamente.valor
                }
            } else if (solicitaLeituraTag.sucesso.tag.isStruct) {

                switch (solicitaLeituraTag.sucesso.tag.struct.dataTypeStruct.codigoTipoStruct) {
                    case DataTypes.structs.ASCIISTRING82.codigoTipoStruct: {
                        dataType.isStruct = true;
                        dataType.struct = {
                            classeStruct: undefined,
                            codigoStruct: undefined
                        }

                        dataType.struct.codigoStruct = dataTypes.structs.ASCIISTRING82.codigoTipoStruct;

                        /**
                         * @type {EscreveTagStructASCIIString82}
                         */
                        let classeStructASCII = {
                            string: dataType.resolverAutomaticamente.valor
                        }
                        dataType.struct.classeStruct = classeStructASCII;
                        break;
                    }
                    default: {

                        retornoEscrita.erro.descricao = ` O Data Type retornado é um Struct porém o tipo dele (${solicitaLeituraTag.sucesso.tag.struct.dataTypeStruct.codigo}) não suportado.`;
                        retornoEscrita.erro.isObterDataTypeAutomatico = true;
                    }
                }
            } else {

                retornoEscrita.erro.descricao = `O Data Type retornado não é atomico nem um Struct.`;
                retornoEscrita.erro.isObterDataTypeAutomatico = true;
                return retornoEscrita;
            }
        }

        /**
         * O Buffer onde vou armazenar a operação de escrita pro CIP Generic Class
         * @type {Buffer}
         */
        let bufferDataTypeEscrita;

        // Pra setar uma tag pelo menos no CompactLogix, o CIP Generic Data deve conter as informações do tipo da Data Type e o valor correspondente. Por isso preciso fazer a tratativa pro Data Type informado

        // Tratamento para Data Types atomicos(numeros)
        if (dataType.isAtomico) {

            const detalhesDataType = this.getDataTypeAtomico(dataType.atomico.codigoAtomico);

            // Se foi informado um Data Type atomico que não existe.
            if (detalhesDataType == undefined) {
                retornoEscrita.erro.isTipoDataTypeInexistente = true;
                retornoEscrita.erro.descricao = `Data Type atomico informado não existe: ${dataType.atomico.codigoAtomico}`;
                return retornoEscrita;
            }

            // Ok, se o Data Type atomico for valido, verificar se o valor informado combina com um numero
            if (isNaN(dataType.atomico.valor)) {
                retornoEscrita.erro.isTipoValorInvalido = true;
                retornoEscrita.erro.descricao = `O valor informado (${dataType.atomico.valor}) não é um compatível para o Data Type atomico (${detalhesDataType.codigo} - ${detalhesDataType.descricao}).`;
                return retornoEscrita;
            }

            const valorParaEscrever = dataType.atomico.valor;

            // Verificar se o numero informado caberia no Data Type informado
            if (detalhesDataType.isSigned) {

                // Validar se o novo valor informado não vai ultrapassar o limite negativo do Data Type
                let valorMinimo = -(2 ** ((detalhesDataType.tamanho * 8) - 1));
                let valorMaximo = (2 ** ((detalhesDataType.tamanho * 8) - 1)) - 1;

                if (valorParaEscrever < valorMinimo) {
                    retornoEscrita.erro.descricao = `O valor informado (${valorParaEscrever}) ultrapassa o limite minimo do Data Type atomico (${detalhesDataType.codigo} - ${detalhesDataType.descricao}). Valor minimo: ${valorMinimo}`;
                    retornoEscrita.erro.isTipoValorInvalido = true;
                    return retornoEscrita;
                } else if (valorParaEscrever > valorMaximo) {
                    retornoEscrita.erro.isTipoValorInvalido = true;
                    retornoEscrita.erro.descricao = `O valor informado (${valorParaEscrever}) ultrapassa o limite maximo do Data Type atomico (${detalhesDataType.codigo} - ${detalhesDataType.descricao}). Valor maximo: ${valorMaximo}`;
                    return retornoEscrita;
                }

            } else {

                // Tratativa para numeros unsigneds
                if (valorParaEscrever < 0) {
                    retornoEscrita.erro.descricao = `O valor informado (${valorParaEscrever}) é negativo, porém o Data Type atomico (${detalhesDataType.codigo} - ${detalhesDataType.descricao}) não aceita valores negativos.`;
                    retornoEscrita.erro.isTipoValorInvalido = true;
                    return retornoEscrita
                }

                // Validar se o novo valor informado não vai ultrapassar o limite positivo do Data Type
                let valorMaximo = (2 ** (detalhesDataType.tamanho * 8)) - 1;

                if (valorParaEscrever > valorMaximo) {
                    retornoEscrita.erro.descricao = `O valor informado (${valorParaEscrever}) ultrapassa o limite maximo do Data Type atomico (${detalhesDataType.codigo} - ${detalhesDataType.descricao}). Valor maximo: ${valorMaximo}`;
                    retornoEscrita.erro.isTipoValorInvalido = true;
                    return retornoEscrita;
                }
            }

            // Após as verificações de tamanho, eu sei que o novo valor deverá caber na tag.

            // Para tipos numericos, o Buffer é composto de:
            // 2 Bytes do Data Type atomico
            // 2 Bytes do Tamanho do Data Type. Para numeros atomicos, é sempre 1.
            const bufferDataType = Buffer.alloc(4);

            bufferDataType.writeUInt16LE(detalhesDataType.codigo, 0);
            bufferDataType.writeUInt16LE(1, 2);

            // O resto do buffer é o tamanho do Data Type em bytes
            const bufferValor = Buffer.alloc(detalhesDataType.tamanho);

            if (detalhesDataType.isSigned) {
                if (detalhesDataType.tamanho <= 6) {
                    bufferValor.writeIntLE(valorParaEscrever, 0, detalhesDataType.tamanho);
                } else {
                    bufferValor.writeBigInt64LE(BigInt(valorParaEscrever), 0, detalhesDataType.tamanho);
                }
            } else {
                if (detalhesDataType.tamanho <= 6) {
                    bufferValor.writeUIntLE(valorParaEscrever, 0, detalhesDataType.tamanho);
                } else {
                    bufferValor.writeBigUInt64LE(BigInt(valorParaEscrever), 0, detalhesDataType.tamanho);
                }
            }

            // Juntar os dois e retornar ele
            bufferDataTypeEscrita = Buffer.concat([bufferDataType, bufferValor]);

            retornoEscrita.sucesso.tag.isAtomico = true;
            retornoEscrita.sucesso.tag.atomico.valor = valorParaEscrever;
            retornoEscrita.sucesso.tag.atomico.dataType = detalhesDataType;
        } else if (dataType.isStruct) {
            // Tratamento para Data Types do tipo Struct(672)

            // Analisar o tipo da Struct informada
            switch (dataType.struct.codigoStruct) {

                // Se o Struct informado é uma String ASCII 82
                case DataTypes.structs.ASCIISTRING82.codigoTipoStruct: {
                    /**
                     * @type {EscreveTagStructASCIIString82}
                     */
                    const classeStructASCIIString82 = dataType.struct.classeStruct;
                    if (classeStructASCIIString82.string == undefined) {

                        retornoEscrita.erro.isTipoValorInvalido = true;
                        retornoEscrita.erro.descricao = 'String a ser escrita não informada';
                        return retornoEscrita;
                    }

                    // Da um toString só pra garantir
                    let stringPraEscrever = classeStructASCIIString82.string.toString();

                    // Como o tamanho maximo permitido é 82, eu corto por garantia se for maior
                    if (stringPraEscrever.length > 82) {
                        stringPraEscrever = stringPraEscrever.substring(0, 82);
                    }

                    // Ok agora com as informações da Struct da string, vou montar o Buffer completo
                    // O Buffer pra escrever uma Struct String é composto de:
                    // 2 Bytes do Data Type Struct que é 672
                    // 2 Bytes do Tipo da Struct, que no caso é ASCII String 82
                    // 2 Bytes pro tamanho do Tipo da Struct, que no caso também é 1 apenas
                    // x Bytes restantes são para a string em si
                    let bufferDataType = Buffer.alloc(6);

                    // Escrever o Data Type Struct
                    bufferDataType.writeUInt16LE(672, 0);

                    // Escrever o Tipo da Struct
                    bufferDataType.writeUInt16LE(DataTypes.structs.ASCIISTRING82.codigoTipoStruct, 2);

                    // Escrever o tamanho do Tipo da Struct(que é sempre 1 pra esse caso de Struct)
                    bufferDataType.writeUInt16LE(1, 4);
                    // -------

                    // Agora o resto do buffer de 88 bytes de
                    // 4 Bytes contendo o tamanho da string
                    // 84 Bytes contendo a string em si
                    let bufferString = Buffer.alloc(88);
                    bufferString.writeUInt32LE(stringPraEscrever.length, 0);

                    bufferString.write(stringPraEscrever, 4, stringPraEscrever.length);

                    // Juntar os dois buffers
                    bufferDataTypeEscrita = Buffer.concat([bufferDataType, bufferString]);

                    /**
                     * @type {EscreveTagStructASCIIString82}
                     */
                    const retornoEscritaStructASCIIString82 = {
                        string: stringPraEscrever
                    }

                    retornoEscrita.sucesso.tag.isStruct = true;
                    retornoEscrita.sucesso.tag.struct.dataTypeStruct = DataTypes.structs.ASCIISTRING82;
                    retornoEscrita.sucesso.tag.struct.valor = retornoEscritaStructASCIIString82
                    break;
                }
                default: {
                    retornoEscrita.erro.descricao = `Tipo de Struct informado não existe ou não é suportado ainda: ${dataType.struct.codigoStruct}`;
                    retornoEscrita.erro.isTipoDataTypeInexistente = true;

                    return;
                }
            }
        }

        // Validar se o usuario informou uma tag de array dimensinal (verificar se existe o [] e o index dentro)
        let isArrayIndex = tag.match(/\[\d+\]/g);

        // Se contiver o index do numero
        if (isArrayIndex) {

            // Cortar somente o nome da tag sem os []
            let nomeTagCortadad = tag.split('[')[0];
            let indexSolicitado = parseInt(isArrayIndex[0].replace('[', '').replace(']', ''));

            // Para escrita de tags que correspondem a localização de um array, devo incluir o Member Request Path que inclua qual o membro(index do array no CompactLogix)
            layerServicePacket.setAsSetAttribute({
                nome: `${nomeTagCortadad}`,
                CIPGenericBuffer: bufferDataTypeEscrita,
                MemberRequestPath: Buffer.from([0x28, indexSolicitado])
            })
        } else {
            // Pra escrita de uma tag pelo menos no CompactLogix, o CIP Generic data deve ser só o Request Path pra string da tag, e o CIP Class Generic é só um array vazio já que não precisa enviar informações
            layerServicePacket.setAsSetAttribute({
                nome: `${tag}`,
                CIPGenericBuffer: bufferDataTypeEscrita
            })
        }

        retornoEscrita.msDetalhes.dateTimeInicio = new Date().getTime();

        if (retornoEscrita.sucesso.tag.isAtomico) {
            this.log(`Tag (${tag}) [Atomico Data Type ${retornoEscrita.sucesso.tag.atomico.dataType.codigo} - ${retornoEscrita.sucesso.tag.atomico.dataType.descricao}] tentando escrever o número: ${retornoEscrita.sucesso.tag.atomico.valor}`);
        } else if (retornoEscrita.sucesso.tag.isStruct) {
            if (retornoEscrita.sucesso.tag.struct.dataTypeStruct.codigoTipoStruct == DataTypes.structs.ASCIISTRING82.codigoTipoStruct) {
                this.log(`Tag (${tag}) [Struct Data Type ${retornoEscrita.sucesso.tag.struct.dataTypeStruct.codigoTipoStruct} - ${retornoEscrita.sucesso.tag.struct.dataTypeStruct.descricao}] tentando escrever a String: ${retornoEscrita.sucesso.tag.struct.valor.valor}`);
            }
        }

        // Ok, agora enviar a solicitação ENIP
        const statusEnviaENIP = await this.getENIPSocket().enviarENIP(layerENIP);

        retornoEscrita.msDetalhes.dateTimeFim = new Date().getTime();
        retornoEscrita.msDetalhes.totalMsEscrita = retornoEscrita.msDetalhes.dateTimeFim - retornoEscrita.msDetalhes.dateTimeInicio;

        // Verificar se o pacote ENIP foi enviado com sucesso
        if (!statusEnviaENIP.isSucesso) {

            // Ocorreu algum erro na transmissão do ENIP, verificar
            if (!statusEnviaENIP.enipEnviar.isEnviou) {

                if (statusEnviaENIP.enipEnviar.erro.isWriteSocket) {
                    // O erro foi causado na hora de usar o Write pra escrever no Socket
                    retornoEscrita.erro.enviarENIP.isWriteSocket = true;
                } else if (statusEnviaENIP.enipEnviar.erro.isGerarBuffer) {
                    // O erro foi causado na geração do Buffer do Builder do ENIP. Algum campo invalido provavelmente
                    retornoEscrita.erro.enviarENIP.isGerarBuffer = true;
                    retornoEscrita.erro.enviarENIP.gerarBuffer.traceLog = statusEnviaENIP.enipEnviar.erro.erroGerarBuffer.traceLog;
                }

                retornoEscrita.erro.descricao = `O envio do ENIP retornou: ${statusEnviaENIP.enipEnviar.erro.descricao} `;
                retornoEscrita.erro.isEnviarENIP = true;

                this.log(`Erro ao escrever a tag ${tag}: ${retornoEscrita.erro.descricao}`);
                return retornoEscrita;
            }

            // Se deu erro ao receber o ENIP, verificar.
            if (!statusEnviaENIP.enipReceber.isRecebeu) {

                if (statusEnviaENIP.enipReceber.erro.isDemorouResposta) {
                    // O erro foi causado por demorar a resposta do pacote ENIP
                    retornoEscrita.erro.receberENIP.isDemorouResposta = true;
                }

                retornoEscrita.erro.descricao = `O recebimento do ENIP retornou: ${statusEnviaENIP.enipReceber.erro.descricao} `;
                retornoEscrita.erro.isReceberENIP = true;

                this.log(`Erro ao escrever a tag ${tag}: ${retornoEscrita.erro.descricao}`);
                return retornoEscrita;
            }
        }

        // Se chegou aqui, eu tenho o pacote ENIP de resposta do controlador. Agora preciso verificar se ele retornou sucesso ou não na operação de escrita
        const ENIPResposta = statusEnviaENIP.enipReceber.enipParser;

        // Validar se o pacote ENIP recebido foi validado com sucesso
        if (!ENIPResposta.isValido().isValido) {
            retornoEscrita.erro.descricao = `O pacote ENIP recebido não é valido, alguma informação no Buffer está incorreta: ${ENIPResposta.isValido().erro.descricao} `;
            retornoEscrita.erro.isENIPInvalido = true;
            retornoEscrita.erro.ENIPInvalido.trace = ENIPResposta.isValido().tracer.getHistoricoOrdenado();

            return retornoEscrita;
        }

        // Se o pacote ENIP for valido, verificar se seu status retornou sucesso, já que qualquer outro status além de Sucesso não retorna nenhum dado, não teria como continuar
        if (!ENIPResposta.isStatusSucesso().isSucesso) {
            retornoEscrita.erro.descricao = `O pacote ENIP retornou um status de erro: ${ENIPResposta.getStatus().codigo} - ${ENIPResposta.getStatus().mensagem}`;

            retornoEscrita.erro.isENIPStatusErro = true;
            retornoEscrita.erro.ENIPStatusErro.codigo = ENIPResposta.getStatus().codigo;
            retornoEscrita.erro.ENIPStatusErro.descricao = ENIPResposta.getStatus().mensagem;

            return retornoEscrita;
        }

        // O comando que deve ser retornado é um SendRRData. Na teoria isso nunca deveria cair aqui pq a resposta do ENIP sempre deve corresponder a solicitação original, se enviou um SendRRData, deve receber um SendRRData
        if (!ENIPResposta.isSendRRData()) {

            retornoEscrita.erro.descricao = 'O pacote de resposta não é um SendRRData.';
            retornoEscrita.erro.isErroLayers = true;
            retornoEscrita.erro.erroLayers.isSendRRDataInvalido = true;

            this.log(`Erro ao escrever a tag ${tag}: ${retornoEscrita.erro.descricao}`);
            return retornoEscrita;
        }

        // Obter as informações do SendRRData
        const ENIPSendRRData = ENIPResposta.getAsSendRRData();

        // Se retornou um SendRRData, validar se o parser conseguiu extrair as informações corretamente
        if (!ENIPSendRRData.isValido().isValido) {

            retornoEscrita.erro.descricao = `O pacote SendRRData não é valido, alguma informação no Buffer está incorreta: ${ENIPSendRRData.isValido().erro.descricao} `;
            retornoEscrita.erro.isErroLayers = true;
            retornoEscrita.erro.erroLayers.isSendRRDataInvalido = true;
            retornoEscrita.erro.erroLayers.sendRRDataInvalido.trace = ENIPSendRRData.isValido().tracer.getHistoricoOrdenado();

            this.log(`Erro ao escrever a tag ${tag}: ${retornoEscrita.erro.descricao}`);
            return retornoEscrita;
        }

        // Obrigatoriamente deve ser um serviço CIP que contém os dados encapsulados da informação de escrita da tag(já que a comunicação no momento com o Compact tá sendo via CIP)
        if (!ENIPSendRRData.isServicoCIP()) {

            retornoEscrita.erro.descricao = 'O pacote de resposta não contém um serviço CIP';
            retornoEscrita.erro.isErroLayers = true;
            retornoEscrita.erro.erroLayers.isCIPInvalido = true;

            this.log(`Erro ao escrever a tag ${tag}: ${retornoEscrita.erro.descricao}`);
            return retornoEscrita;
        }

        // Obter as informações do Serviço CIP que contém nessa altura do jogo, o CIP Connection Manager com as informações solicitadas
        const ENIPCIP = ENIPSendRRData.getAsServicoCIP();
        if (!ENIPCIP.isValido().isValido) {

            retornoEscrita.erro.descricao = `O pacote CIP não é valido, alguma informação no Buffer está incorreta: ${ENIPCIP.isValido().erro.descricao} `;
            retornoEscrita.erro.isErroLayers = true;
            retornoEscrita.erro.erroLayers.isCIPInvalido = true;
            retornoEscrita.erro.erroLayers.CIPInvalido.trace = ENIPCIP.isValido().tracer.getHistoricoOrdenado();

            this.log(`Erro ao escrever a tag ${tag}: ${retornoEscrita.erro.descricao}`);
            return retornoEscrita;
        }

        // Como foi uma solicitação via Connection Manager, buildo o Connection Manager pra pegar o Single Service Packet
        const CIPConnectionManager = ENIPCIP.getAsConnectionManager();
        if (!CIPConnectionManager.isValido().isValido) {

            retornoEscrita.erro.descricao = `O pacote Connection Manager não é valido, alguma informação no Buffer está incorreta: ${CIPConnectionManager.isValido().erro.descricao} `;
            retornoEscrita.erro.isErroLayers = true;
            retornoEscrita.erro.erroLayers.isCIPInvalido = true;
            retornoEscrita.erro.erroLayers.CIPInvalido.trace = CIPConnectionManager.isValido().tracer.getHistoricoOrdenado();

            this.log(`Erro ao escrever a tag ${tag}: ${retornoEscrita.erro.descricao}`);
            return retornoEscrita
        }

        // Por último, o pacote CIP deve encapsular o Single Service Packet que foi a informação da tag escrita
        if (!CIPConnectionManager.isSingleServicePacket()) {
            retornoEscrita.erro.descricao = 'O pacote de resposta não contém um Single Service Packet';

            retornoEscrita.erro.isErroLayers = true;
            retornoEscrita.erro.erroLayers.isSingleServicePacket = true;

            this.log(`Erro ao escrever a tag ${tag}: ${retornoEscrita.erro.descricao}`);
            return retornoEscrita;
        }

        const ENIPSingleService = CIPConnectionManager.getAsSingleServicePacket();

        // Validar se é deu pra dar parse no Buffer sem erros.
        if (!ENIPSingleService.isValido().isValido) {

            retornoEscrita.erro.descricao = `O pacote Single Service Packet não é valido, alguma informação no Buffer está incorreta: ${ENIPSingleService.isValido().erro.descricao} `;
            retornoEscrita.erro.isErroLayers = true;
            retornoEscrita.erro.erroLayers.isSingleServicePacket = true;
            retornoEscrita.erro.erroLayers.singleServicePacket.trace = ENIPSingleService.isValido().tracer.getHistoricoOrdenado();

            this.log(`Erro ao escrever a tag ${tag}: ${retornoEscrita.erro.descricao}`);
            return retornoEscrita;
        }

        // Analisar se o SingleServicePacket retornou sucesso ou não
        if (!ENIPSingleService.isStatusSucesso().isSucesso) {

            retornoEscrita.erro.isStatusInvalido = true;
            retornoEscrita.erro.statusInvalido.codigoDeErro = ENIPSingleService.getStatus().codigoStatus;
            retornoEscrita.erro.statusInvalido.descricaoStatus = ENIPSingleService.getStatus().descricaoStatus;

            // Analisar o motivo do erro
            switch (ENIPSingleService.getStatus().codigoStatus) {

                // O Path Segment Error ocorre quando a tag não existe
                case CIPGeneralStatusCodes.PathSegmentError.hex: {
                    retornoEscrita.erro.descricao = `A tag não existe no controlador`;
                    retornoEscrita.erro.statusInvalido.isTagNaoExiste = true;
                    break;
                }
                default: {
                    retornoEscrita.erro.descricao = `O pacote Single Service Packet retornou um status de erro: ${ENIPSingleService.getStatus().codigoStatus} - ${ENIPSingleService.getStatus().descricaoStatus} `;

                    let bufferAdditionalStatus = ENIPSingleService.getStatus().additionalStatusCode.buffer;

                    // Se foi retornado o Additional Status 
                    if (bufferAdditionalStatus != undefined) {
                        retornoEscrita.erro.statusInvalido.additionalStatus = bufferAdditionalStatus;
                        let codigoErroExtra = bufferAdditionalStatus.readUInt16LE(0);

                        switch (codigoErroExtra) {
                            // Se o erro extra for 0x2107, significa que o data type informado pra tag é incorreto
                            case 8455: {
                                retornoEscrita.erro.statusInvalido.isDataTypeIncorreto = true;
                                retornoEscrita.erro.descricao += `/ Data Type informado para a tag é incorreto`;
                                break;
                            }
                            default:
                                retornoEscrita.erro.descricao += `/ Additional Status Code retornado: ${codigoErroExtra}`;
                                break;
                        }
                    }
                    break;
                }
            }

            this.log(`Erro ao escrever a tag ${tag}: ${retornoEscrita.erro.descricao}`);
            return retornoEscrita;
        }

        // Se chegou aqui, a operação de escrita foi bem sucedida
        if (retornoEscrita.sucesso.tag.isAtomico) {
            this.log(`Tag (${tag}) [Atomico Data Type ${retornoEscrita.sucesso.tag.atomico.dataType.codigo} - ${retornoEscrita.sucesso.tag.atomico.dataType.descricao}] escrita com o número ${retornoEscrita.sucesso.tag.atomico.valor} em ${retornoEscrita.msDetalhes.totalMsEscrita}ms`);
        } else if (retornoEscrita.sucesso.tag.isStruct) {
            if (retornoEscrita.sucesso.tag.struct.dataTypeStruct.codigoTipoStruct == DataTypes.structs.ASCIISTRING82.codigoTipoStruct) {
                this.log(`Tag (${tag}) [Struct Data Type ${retornoEscrita.sucesso.tag.struct.dataTypeStruct.codigoTipoStruct} - ${retornoEscrita.sucesso.tag.struct.dataTypeStruct.descricao}] escrita com a String ${retornoEscrita.sucesso.tag.struct.valor.valor} em ${retornoEscrita.msDetalhes.totalMsEscrita}ms`);
            }
        }

        retornoEscrita.isSucesso = true;
        return retornoEscrita;
    }

    /**
     * @typedef EscritaTag
     * @property {String} tag - Nome da tag para escrever
     * @property {Object} dataType - O Data Type da tag a ser escrita
     * @property {Boolean} dataType.isResolverAutomaticamente - Se true, será feito uma tentativa de resolver o Data Type automaticamente solicitando ao CompactLogix os dados da tag.
     * @property {Object} dataType.resolverAutomaticamente - Se isResolverAutomaticamente, informe os detalhes da escrita da tag
     * @property {*} dataType.resolverAutomaticamente.valor - O valor a ser escrito que seja compatível com o tipo da tag.
     * @property {Boolean} dataType.isAtomico - Se o Data Type é atomico(numeros)
     * @property {Object} dataType.atomico - Se atomico, contém os detalhes do valor a ser escrito
     * @property {Number} dataType.atomico.codigoAtomico - Código do tipo de Data Type a ser escrito
     * @property {Number} dataType.atomico.valor - Valor númerico a ser escrito
     * @property {Boolean} dataType.isStruct - Se o Data Type é do tipo Struct
     * @property {Object} dataType.struct - Se isStruct, contém os detalhes do Data Type Struct
     * @property {Number} dataType.struct.codigoStruct - Código do tipo de Data Type Struct a ser escrito
     * @property {EscreveTagStructASCIIString82} dataType.struct.classeStruct - Se isStruct, contém a classe da Struct a ser escrita
     */

    /**
     * Escreve multiplas tags de uma vez só
     * @param {EscritaTag[]} tags - Array de tags a serem escritas
     */
    async escreveMultiplasTags(tags) {
        if (tags == undefined) throw new Error('Nenhuma tag informada para escrever');
        if (!Array.isArray(tags)) throw new Error('As tags informadas não são um array');
        if (tags.length == 0) throw new Error('Nenhuma tag informada para escrever');


        /**
         * @typedef RetornoTagEscritaMultipla
         * @property {String} tag - Nome da tag escrita
         * @property {Object} dataTypeDados - Dados do Data Type da tag escrita
         * @property {Boolean} dataTypeDados.isValido - Se o Data Type originalmente informado corresponde com algum tipo valido
         * @property {Boolean} dataTypeDados.isAtomico - Se o Data Type é atomico(numeros)
         * @property {Object} dataTypeDados.atomico - Se atomico, contém os detalhes do valor a ser escrito
         * @property {Number} dataTypeDados.atomico.codigoAtomico - Código do tipo de Data Type a ser escrito
         * @property {Number} dataTypeDados.atomico.valor - Valor númerico a ser escrito
         * @property {Boolean} dataTypeDados.isStruct - Se o Data Type é do tipo Struct
         * @property {Object} dataTypeDados.struct - Se isStruct, contém os detalhes do Data Type Struct
         * @property {Number} dataTypeDados.struct.codigoStruct - Código do tipo de Data Type Struct a ser escrito
         * @property {EscreveTagStructASCIIString82} dataTypeDados.struct.classeStruct - Se isStruct, contém a classe da Struct a ser escrita
         * @property {Boolean} isSucesso - Se a escrita foi realizada com sucesso no dispositivo
         * @property {Object} erro - Se não isSucesso, contém os detalhes do erro ocorrido
         * @property {String} erro.descricao - Descrição generica do erro ocorrido
         * @property {Boolean} erro.isIdentificarDataTypeAutomatico - Se o erro ocorrido foi devido a falha ao tentar identificar automaticamente o Data Type da tag
         * @property {Boolean} erro.isDataTypeInvalido - Se o Data Type informado contém informações incorretas(tipo errado, não existe, valores incorretos para tipos especificos)
         * @property {Boolean} erro.isErroGerarBuffer - Se ocorreu um erro ao gerar o Buffer do SingleServicePacket para escrita da tag
         * @property {Boolean} erro.isCIPNaoRetornado - Se o pacote de resposta não retornou um CIP Packet pra essa tag
         * @property {Boolean} erro.isCIPInvalido - Se o pacote CIP recebido na resposta não é valido(erro de Buffer em algum offset)
         * @property {Object} erro.CIPInvalido - Se isCIPInvalido, contém os detalhes do erro
         * @property {String[]} erro.CIPInvalido.trace - Trace de cada etapa do processamento do Buffer CIP
         * @property {Boolean} erro.isSingleServicePacketNaoRetornado - Se o pacote de resposta não retornou um Single Service Packet pra essa tag
         * @property {Boolean} erro.isSingleServicePacketInvalido - Se o pacote Single Service Packet recebido na resposta não é valido(erro de Buffer em algum offset)
         * @property {Object} erro.singleServicePacketInvalido - Se isSingleServicePacketInvalido, contém os detalhes do erro
         * @property {String[]} erro.singleServicePacketInvalido.trace - Trace de cada etapa do processamento do Buffer Single Service Packet
         * @property {Boolean} erro.isSingleServicePacketStatusErro- Se o pacote Single Service Packet retornou um status de erro
         * @property {Object} erro.SingleServicePacketStatusErro - Se isSingleServicePacketStatusErro, contém os detalhes do erro
         * @property {String} erro.SingleServicePacketStatusErro.codigoStatus - Código do status de erro retornado
         * @property {String} erro.SingleServicePacketStatusErro.descricaoStatus - Descrição do status de erro retornado
         * @property {Buffer} erro.SingleServicePacketStatusErro.additionalStatusBuffer - O Buffer do Additional Status que contém informações adicionais do erro se disponiveis
         * @property {Boolean} erro.SingleServicePacketStatusErro.isTagNaoExiste - Se o erro retornado é Path Segment Error, significa que a tag não existe
         * @property {Boolean} erro.SingleServicePacketStatusErro.isDataTypeIncorreto - Se o erro retornado é 0xFF com o additional status como 0x2107, significa que o data type informado pra tag é incorreto
         */

        const retornoEscrita = {
            /**
             * Se a operação de enviar e receber o pacote ENIP foi bem sucedida. Isso não garante que as tags foram escritas, apenas que pelo menos o pacote foi enviado ao dispositivo, e o dispositivo reconheceu e devolveu algo.
             * Se isSucesso for true, analise isSucesso da tag individualmente para saber se a tag foi escrita com sucesso
             */
            isSucesso: false,
            sucesso: {
                /**
                 * Retorna as informações das tags solicitadas para escrever
                 * @type {RetornoTagEscritaMultipla[]}
                */
                tags: [],
            },
            erro: {
                descricao: '',
                /**
                 * Se o pacote ENIP recebido é invalido
                 */
                isENIPInvalido: false,
                /**
                 * Se isENIPInvalido, contém os detalhes ocorridos durante o parse do Buffer
                 */
                ENIPInvalido: {
                    /**
                     * Trace de cada etapa do processamento do Buffer ENIP
                     * @type {String[]}
                     */
                    trace: []
                },
                /**
                 * Se o pacote ENIP recebido não retornou sucesso
                 */
                isENIPStatusErro: false,
                /**
                 * Se isENIPStatusErro, contém os detalhes do erro ocorrido
                 */
                ENIPStatusErro: {
                    codigo: '',
                    descricao: ''
                }
            }
        }

        // Preparar os layers iniciais
        const layerENIP = this.getENIPSocket().getNovoLayerBuilder();
        const layerConnectionManager = layerENIP.buildSendRRData().criarServicoCIP().buildCIPConnectionManager();

        // Adicionar o Multiple Service Packet que é o pacote que contém as informações das escritas das tags
        const layerMultipleService = layerConnectionManager.getCIPMessage().buildMultipleServicePacket();
        layerMultipleService.setAsMessageRouter();

        /**
         * @typedef PreVerificaTags 
         * @property {Boolean} isValidoParaEnviar - Se a tag possui seu data type corretamente definido assim como seu valor
         * @property {RetornoTagEscritaMultipla} tagObjeto - Objeto tag com suas informações
         * @property {SingleServicePacketServiceBuilder} servicePacket - Builder do Service Packet da tag
         * @property {Number} tamanhoServicePacket - Tamanho em bytes que o serviço packet ocupara
         * @property {Boolean} isIdentificaDataTypeAutomatico - Se o Data Type foi definido pra ser automaticamente identificado
         * @property {Object} identificaDataTypeAutomatico - Se isIdentificaDataTypeAutomatico, contém detalhes da identificação realizada
         * @property {*} identificaDataTypeAutomatico.valor - Valor original que foi informado para ser atribuido na tag identificada
         * @property {Boolean} identificaDataTypeAutomatico.isSucesso - Se a identificação do Data Type foi bem sucedida e o Data Type foi retornado
         * @property {Object} identificaDataTypeAutomatico.erro - Se não deu pra identificar o Data Type, contém o motivo do erro
         * @property {String} identificaDataTypeAutomatico.erro.descricao - Descrição do erro que ocorreu durante a verificação do Data Type
         */

        /**
         * Armazeno todas as escritas de tags pendentes.
         * @type {PreVerificaTags[]}
         */
        const tagsPendenteEscrita = []

        // Primeiro analiso todas as tags que vou precisar escrever e organizo elas no array
        for (const tag of tags) {
            // Se a tag já foi adicionado, não permito adicionar novamente
            if (tagsPendenteEscrita.find(t => t.tagObjeto.tag == tag.tag) != undefined) continue;

            const layerSingleService = layerMultipleService.novoSingleServicePacketTemplate();

            /**
             * @type {PreVerificaTags}
             */
            let novoObjTag = {
                isValidoParaEnviar: false,
                servicePacket: layerSingleService,
                tamanhoServicePacket: 0,
                tagObjeto: {
                    tag: tag.tag,
                    dataTypeDados: {
                        isValido: false,
                        isAtomico: false,
                        isStruct: false,
                        atomico: {
                            codigoAtomico: undefined,
                            valor: undefined
                        },
                        struct: {
                            codigoStruct: undefined,
                            classeStruct: undefined
                        }
                    },
                    isSucesso: false,
                    erro: {
                        descricao: '',
                        isDataTypeInvalido: false,
                        isCIPInvalido: false,
                        isCIPNaoRetornado: false,
                        isErroGerarBuffer: false,
                        isSingleServicePacketInvalido: false,
                        isSingleServicePacketNaoRetornado: false,
                        isSingleServicePacketStatusErro: false,
                        CIPInvalido: {
                            trace: []
                        },
                        singleServicePacketInvalido: {
                            trace: []
                        },
                        isSingleServicePacketStatusErro: false,
                        SingleServicePacketStatusErro: {
                            codigoStatus: '',
                            descricaoStatus: '',
                            isTagNaoExiste: false,
                            isDataTypeIncorreto: false,
                            additionalStatusBuffer: undefined
                        }
                    }
                },
                isIdentificaDataTypeAutomatico: false
            }

            if (tag.dataType == undefined) {
                throw new Error(`Data Type da tag ${tag.tag} não informado`);
            }

            // Marcar se vai ser resolvido o Data Type automatico da tag
            if (tag.dataType.isResolverAutomaticamente) {
                if (tag.dataType.resolverAutomaticamente.valor == undefined) {
                    throw new Error(`Uma tag setada como identificação automatica obrigatoriamente deve ter seu valor definido!`);
                }

                novoObjTag.isIdentificaDataTypeAutomatico = true;
                novoObjTag.identificaDataTypeAutomatico = {
                    valor: tag.dataType.resolverAutomaticamente.valor,
                    isSucesso: false,
                    erro: {
                        descricao: ''
                    }
                }
            } else {
                // Se não é resolvido automaticamente, o usuario deve ter informado o Data Type

                // Essas informações o usuario pode colocar o que quiser, porém mais a frente é validado todos os tipos informados.
                if (tag.dataType.isAtomico) {
                    if (tag.dataType.atomico == undefined) {
                        throw new Error(`Data Type atomico da tag ${tag.tag} não informado`);
                    }

                    if (tag.dataType.atomico.codigoAtomico == undefined) {
                        throw new Error(`Código do Data Type atomico da tag ${tag.tag} não informado`);
                    }

                    if (tag.dataType.atomico.valor == undefined) {
                        throw new Error(`Valor do Data Type atomico da tag ${tag.tag} não informado`);
                    }

                    novoObjTag.tagObjeto.dataTypeDados.isAtomico = true;
                    novoObjTag.tagObjeto.dataTypeDados.atomico.codigoAtomico = tag.dataType.atomico.codigoAtomico;
                    novoObjTag.tagObjeto.dataTypeDados.atomico.valor = tag.dataType.atomico.valor;
                } else if (tag.dataType.isStruct) {
                    if (tag.dataType.struct == undefined) {
                        throw new Error(`Data Type Struct da tag ${tag.tag} não informado`);
                    }

                    if (tag.dataType.struct.codigoStruct == undefined) {
                        throw new Error(`Código do Data Type Struct da tag ${tag.tag} não informado`);
                    }

                    if (tag.dataType.struct.classeStruct == undefined) {
                        throw new Error(`Classe do Data Type Struct da tag ${tag.tag} não informado`);
                    }

                    novoObjTag.tagObjeto.dataTypeDados.isStruct = true;
                    novoObjTag.tagObjeto.dataTypeDados.struct.codigoStruct = tag.dataType.struct.codigoStruct;
                    novoObjTag.tagObjeto.dataTypeDados.struct.classeStruct = tag.dataType.struct.classeStruct;
                } else {
                    throw new Error(`Data Type da tag ${tag.tag} não é atomico nem Struct`);
                }

            }

            tagsPendenteEscrita.push(novoObjTag);
        }

        // Verificar se existem tags definidas para identificar automaticamente o Data Type
        const tagsIdentificarAutomatico = tagsPendenteEscrita.filter(t => t.isIdentificaDataTypeAutomatico);
        if (tagsIdentificarAutomatico.length > 0) {

            // Enviar uma solicitação ENIP pra ler as tags com identificações automaticas
            let solicitarLeituraTags = await this.lerMultiplasTags(tagsIdentificarAutomatico.map(t => t.tagObjeto.tag));
            if (solicitarLeituraTags.isSucesso) {

                // Salvar as informações de cada tag lida
                solicitarLeituraTags.sucesso.tags.forEach(tagLida => {

                    // Pegar o PreVerificaTag que contém os dados da tag
                    const tagSetarDataType = tagsIdentificarAutomatico.find(t => t.tagObjeto.tag == tagLida.tag);
                    if (tagSetarDataType == undefined) return;

                    // Ocorreu um erro ao ler essa tag, anexar o motivo do erro na tag
                    if (!tagLida.isSucesso) {
                        tagSetarDataType.identificaDataTypeAutomatico.erro.descricao = tagLida.erro.descricao;
                        return;
                    }

                    // Beleza, se leu com sucesso, agora eu tenho o Data Type da tag. Vou salvar ele na tag
                    if (tagLida.sucesso.isAtomico) {
                        tagSetarDataType.identificaDataTypeAutomatico.isSucesso = true;
                        tagSetarDataType.tagObjeto.dataTypeDados.isAtomico = true;
                        tagSetarDataType.tagObjeto.dataTypeDados.atomico = {
                            codigoAtomico: tagLida.sucesso.atomico.dataType.codigo,
                            valor: tagSetarDataType.identificaDataTypeAutomatico.valor
                        }
                    } else if (tagLida.sucesso.isStruct) {

                        switch (tagLida.sucesso.struct.dataTypeStruct.codigoTipoStruct) {
                            case DataTypes.structs.ASCIISTRING82.codigoTipoStruct: {

                                tagSetarDataType.identificaDataTypeAutomatico.isSucesso = true;
                                tagSetarDataType.tagObjeto.dataTypeDados.isStruct = true;

                                /**
                                 * Classe Struct do ASCIIStr82
                                 * @type {EscreveTagStructASCIIString82}
                                 */
                                let structASCIIStr82 = {
                                    string: tagSetarDataType.identificaDataTypeAutomatico.valor
                                }

                                tagSetarDataType.tagObjeto.dataTypeDados.struct = {
                                    codigoStruct: tagLida.sucesso.struct.dataTypeStruct.codigoTipoStruct,
                                    classeStruct: structASCIIStr82
                                }
                                break;
                            }
                            default: {

                                tagSetarDataType.identificaDataTypeAutomatico.erro.descricao = `Tipo de Struct informado não existe ou não é suportado ainda: ${tagLida.sucesso.struct.dataTypeStruct.codigoTipoStruct}`;
                                break;
                            }
                        }
                    }
                });
            } else {
                // Se deu erro em buscar, eu salvo em todas as tags o motivo do erro

                tagsIdentificarAutomatico.forEach(t => {
                    t.identificaDataTypeAutomatico.erro.descricao = solicitarLeituraTags.erro.descricao;
                })
            }
        }

        // Agora que todas as tags estão com seus Data Types confirmados, verificar se eles são validos para prosseguir com o envio do ENIP.
        for (const tagParaEscrita of tagsPendenteEscrita) {

            // Preciso verificar cada tag e configurar o Single Service Packet com as informações da tag
            if (tagParaEscrita.tagObjeto.dataTypeDados.isAtomico) {

                // Validar o tipo atomico informado
                const detalhesDataType = this.getDataTypeAtomico(tagParaEscrita.tagObjeto.dataTypeDados.atomico.codigoAtomico);
                if (detalhesDataType == undefined) {
                    tagParaEscrita.tagObjeto.erro.isDataTypeInvalido = true;
                    tagParaEscrita.tagObjeto.erro.descricao = `Data Type atomico informado não existe: ${tagParaEscrita.tagObjeto.dataTypeDados.atomico.codigoAtomico}`;
                    continue;
                }

                // Como é um tipo atomico, verificar se o valor informado é um numero
                if (isNaN(tagParaEscrita.tagObjeto.dataTypeDados.atomico.valor)) {
                    tagParaEscrita.tagObjeto.erro.isDataTypeInvalido = true;
                    tagParaEscrita.tagObjeto.erro.descricao = `O valor informado (${tagParaEscrita.tagObjeto.dataTypeDados.atomico.valor}) não é um compatível para o Data Type atomico (${detalhesDataType.codigo} - ${detalhesDataType.descricao}).`;
                    continue;
                }

                const numeroParaEscrita = tagParaEscrita.tagObjeto.dataTypeDados.atomico.valor;

                // Validar se o valor informado vai caber no data type informado

                // Pra caso o numero possa ser positivo ou negativo
                if (detalhesDataType.isSigned) {


                    let valorMinimo = -(2 ** ((detalhesDataType.tamanho * 8) - 1));
                    let valorMaximo = (2 ** ((detalhesDataType.tamanho * 8) - 1)) - 1;

                    if (numeroParaEscrita < valorMinimo) {
                        retornoEscrita.erro.isTipoValorInvalido = true;
                        retornoEscrita.erro.descricao = `O valor informado (${numeroParaEscrita}) ultrapassa o limite minimo do Data Type atomico (${detalhesDataType.codigo} - ${detalhesDataType.descricao}). Valor minimo: ${valorMinimo}`;
                        continue;
                    } else if (numeroParaEscrita > valorMaximo) {
                        retornoEscrita.erro.isTipoValorInvalido = true;
                        retornoEscrita.erro.descricao = `O valor informado (${numeroParaEscrita}) ultrapassa o limite maximo do Data Type atomico (${detalhesDataType.codigo} - ${detalhesDataType.descricao}). Valor maximo: ${valorMaximo}`;
                        continue;
                    }

                } else {
                    // Numeros positivos (unsigned)

                    if (numeroParaEscrita < 0) {
                        retornoEscrita.erro.descricao = `O valor informado (${numeroParaEscrita}) é negativo, porém o Data Type atomico (${detalhesDataType.codigo} - ${detalhesDataType.descricao}) não aceita valores negativos.`;
                        retornoEscrita.erro.isTipoValorInvalido = true;
                        continue;
                    }

                    const valorMaximo = (2 ** (detalhesDataType.tamanho * 8)) - 1;
                    if (numeroParaEscrita > valorMaximo) {
                        retornoEscrita.erro.descricao = `O valor informado (${numeroParaEscrita}) ultrapassa o limite maximo do Data Type atomico (${detalhesDataType.codigo} - ${detalhesDataType.descricao}). Valor maximo: ${valorMaximo}`;
                        retornoEscrita.erro.isTipoValorInvalido = true;
                        continue;
                    }
                }

                // Ok com todas as verificações, criar o Buffer de escrita pro Service Packet
                // Para tipos numericos, o Buffer é composto de:
                // 2 Bytes do Data Type atomico
                // 2 Bytes do Tamanho do Data Type. Para numeros atomicos, é sempre 1.
                const bufferDataType = Buffer.alloc(4);

                bufferDataType.writeUInt16LE(detalhesDataType.codigo, 0);
                bufferDataType.writeUInt16LE(1, 2);

                // O resto do buffer é o tamanho do Data Type em bytes
                const bufferValor = Buffer.alloc(detalhesDataType.tamanho);

                if (detalhesDataType.isSigned) {
                    if (detalhesDataType.tamanho <= 6) {
                        bufferValor.writeIntLE(numeroParaEscrita, 0, detalhesDataType.tamanho);
                    } else {
                        bufferValor.writeBigInt64LE(BigInt(numeroParaEscrita), 0, detalhesDataType.tamanho);
                    }
                } else {
                    if (detalhesDataType.tamanho <= 6) {
                        bufferValor.writeUIntLE(numeroParaEscrita, 0, detalhesDataType.tamanho);
                    } else {
                        bufferValor.writeBigUInt64LE(BigInt(numeroParaEscrita), 0, detalhesDataType.tamanho);
                    }
                }

                // Juntar os dois e retornar ele
                const bufferDataTypeEscrita = Buffer.concat([bufferDataType, bufferValor]);

                // Validar se o usuario informou uma tag de array dimensinal (verificar se existe o [] e o index dentro)
                let isArrayIndex = tagParaEscrita.tagObjeto.tag.match(/\[\d+\]/g);

                // Se contiver o index do numero
                if (isArrayIndex) {

                    // Cortar somente o nome da tag sem os []
                    let nomeTagCortadad = tagParaEscrita.tagObjeto.tag.split('[')[0];
                    let indexSolicitado = parseInt(isArrayIndex[0].replace('[', '').replace(']', ''));

                    // Para leituras de tags que correspondem a localização de um array, devo incluir o Member Request Path que inclua qual o membro(index do array no CompactLogix)
                    tagParaEscrita.servicePacket.setAsSetAttribute({
                        nome: `${nomeTagCortadad}`,
                        CIPGenericBuffer: bufferDataTypeEscrita,
                        MemberRequestPath: Buffer.from([0x28, indexSolicitado])
                    })
                } else {
                    // Pra ler uma tag pelo menos no CompactLogix, o CIP Generic data deve ser só o Request Path pra string da tag, e o CIP Class Generic é só um array vazio já que não precisa enviar informações
                    tagParaEscrita.servicePacket.setAsSetAttribute({
                        nome: `${tagParaEscrita.tagObjeto.tag}`,
                        CIPGenericBuffer: bufferDataTypeEscrita
                    })
                }

                // Definir como valido para enviar nas requisições
                tagParaEscrita.isValidoParaEnviar = true;

                // Salvar também as informações do data type
                tagParaEscrita.tagObjeto.dataTypeDados.isValido = true;
                tagParaEscrita.tagObjeto.dataTypeDados.isAtomico = true;
                tagParaEscrita.tagObjeto.dataTypeDados.atomico.codigoAtomico = detalhesDataType.codigo;
                tagParaEscrita.tagObjeto.dataTypeDados.atomico.valor = numeroParaEscrita;

            } else if (tagParaEscrita.tagObjeto.dataTypeDados.isStruct) {

                // Se o Struct informado é uma String ASCII 82
                switch (tagParaEscrita.tagObjeto.dataTypeDados.struct.codigoStruct) {
                    case DataTypes.structs.ASCIISTRING82.codigoTipoStruct: {

                        /**
                         * @type {EscreveTagStructASCIIString82}
                         */
                        const classeStructASCIIString82 = tagParaEscrita.tagObjeto.dataTypeDados.struct.classeStruct;
                        if (classeStructASCIIString82.string == undefined) {
                            tagParaEscrita.tagObjeto.erro.isDataTypeInvalido = true;
                            tagParaEscrita.tagObjeto.erro.descricao = 'O Data Type Struct informado é uma String ASCII 82, porém a string a ser escrita não foi informada';
                            continue;
                        }

                        let stringParaEscrever = classeStructASCIIString82.string.toString();

                        // Como o tamanho maximo permitido é 82, eu corto por garantia se for maior
                        if (stringParaEscrever.length > 82) {
                            stringParaEscrever = stringParaEscrever.substring(0, 82);
                        }

                        // Ok agora com as informações da Struct da string, vou montar o Buffer completo
                        // O Buffer pra escrever uma Struct String é composto de:
                        // 2 Bytes do Data Type Struct que é 672
                        // 2 Bytes do Tipo da Struct, que no caso é ASCII String 82
                        // 2 Bytes pro tamanho do Tipo da Struct, que no caso também é 1 apenas
                        // x Bytes restantes são para a string em si
                        let bufferDataType = Buffer.alloc(6);

                        // Escrever o Data Type Struct
                        bufferDataType.writeUInt16LE(672, 0);

                        // Escrever o Tipo da Struct
                        bufferDataType.writeUInt16LE(DataTypes.structs.ASCIISTRING82.codigoTipoStruct, 2);

                        // Escrever o tamanho do Tipo da Struct(que é sempre 1 pra esse caso de Struct)
                        bufferDataType.writeUInt16LE(1, 4);
                        // -------

                        // Agora o resto do buffer de 88 bytes de
                        // 4 Bytes contendo o tamanho da string
                        // 84 Bytes contendo a string em si
                        let bufferString = Buffer.alloc(88);
                        bufferString.writeUInt32LE(stringParaEscrever.length, 0);

                        bufferString.write(stringParaEscrever, 4, stringParaEscrever.length);

                        // Juntar os dois buffers
                        const bufferDataTypeEscrita = Buffer.concat([bufferDataType, bufferString]);

                        // Validar se o usuario informou uma tag de array dimensinal (verificar se existe o [] e o index dentro)
                        let isArrayIndex = tagParaEscrita.tagObjeto.tag.match(/\[\d+\]/g);

                        // Se contiver o index do numero
                        if (isArrayIndex) {

                            // Cortar somente o nome da tag sem os []
                            let nomeTagCortadad = tagParaEscrita.tagObjeto.tag.split('[')[0];
                            let indexSolicitado = parseInt(isArrayIndex[0].replace('[', '').replace(']', ''));

                            // Para leituras de tags que correspondem a localização de um array, devo incluir o Member Request Path que inclua qual o membro(index do array no CompactLogix)
                            tagParaEscrita.servicePacket.setAsSetAttribute({
                                nome: `${nomeTagCortadad}`,
                                CIPGenericBuffer: bufferDataTypeEscrita,
                                MemberRequestPath: Buffer.from([0x28, indexSolicitado])
                            })
                        } else {
                            // Pra ler uma tag pelo menos no CompactLogix, o CIP Generic data deve ser só o Request Path pra string da tag, e o CIP Class Generic é só um array vazio já que não precisa enviar informações
                            tagParaEscrita.servicePacket.setAsSetAttribute({
                                nome: `${tagParaEscrita.tagObjeto.tag}`,
                                CIPGenericBuffer: bufferDataTypeEscrita
                            })
                        }

                        /**
                         * @type {EscreveTagStructASCIIString82}
                         */
                        const retornoEscritaStructASCIIString82 = {
                            string: stringParaEscrever
                        }

                        // Setar como validado para enviar no ENIP
                        tagParaEscrita.isValidoParaEnviar = true;

                        // Setar as informações do data type da tag
                        tagParaEscrita.tagObjeto.dataTypeDados.isValido = true;

                        tagParaEscrita.tagObjeto.dataTypeDados.isStruct = true;
                        tagParaEscrita.tagObjeto.dataTypeDados.struct = {
                            classeStruct: retornoEscritaStructASCIIString82,
                            codigoStruct: DataTypes.structs.ASCIISTRING82.codigoTipoStruct
                        }
                        break;
                    }
                    default: {
                        tagParaEscrita.tagObjeto.erro.isDataTypeInvalido = true;
                        tagParaEscrita.tagObjeto.erro.descricao = `Tipo de Struct informada '${tagParaEscrita.tagObjeto.dataTypeDados.struct.codigoStruct}' não existe ou não é suportado ainda.`;
                        continue;
                    }
                }
            } else {

                // Se foi informado pra identificar o data type e não teve exito
                if (tagParaEscrita.isIdentificaDataTypeAutomatico && !tagParaEscrita.identificaDataTypeAutomatico.isSucesso) {
                    tagParaEscrita.tagObjeto.erro.isIdentificarDataTypeAutomatico = true;
                    tagParaEscrita.tagObjeto.erro.descricao = `Erro ao tentar identificar automaticamente o Data Type: ${tagParaEscrita.identificaDataTypeAutomatico.erro.descricao}`;
                } else {
                    // Para qualquer tipo invalido ou não suportado ainda que foi informado manualmente
                    tagParaEscrita.tagObjeto.erro.isDataTypeInvalido = true;

                    tagParaEscrita.tagObjeto.erro.descricao = `O Data Type informado para a tag '${tagParaEscrita.tagObjeto.tag}' não é valido ou não é suportado ainda`;
                }
                continue;
            }

            // Se chegou aqui, a tag foi validada com sucesso com seu data type e valor correto

            // Gerar o buffer do Service Packet pra salvar o tamanho em bytes
            let gerarBufferService = tagParaEscrita.servicePacket.criarBuffer();
            if (!gerarBufferService.isSucesso) {

                tagParaEscrita.tagObjeto.erro.descricao = `Erro ao gerar o buffer do Service Packet para a tag ${tag.tag}: ${gerarBufferService.erro.descricao}. Trace Log: ${gerarBufferService.tracer.getHistoricoOrdenado().join(' -> ')}`;
                continue;
            }

            // Salvar o tamanho do Service Packet
            tagParaEscrita.tamanhoServicePacket = gerarBufferService.sucesso.buffer.length;
        }

        // Após realizar a validação de todas as tags solicitadas, filtrar somente as que foram validadas com sucesso com seus tipos e valores corretos.
        const tagsValidasDeEscrita = tagsPendenteEscrita.filter(t => t.isValidoParaEnviar);

        // Se nenhuma tag tiver sido validada, retorno logo o erro
        if (tagsValidasDeEscrita.length == 0) {
            retornoEscrita.erro.descricao = `Nenhuma das ${tagsPendenteEscrita.length} tags informadas são validas para tentar enviar a escrita de tag.`;
            return retornoEscrita;
        }

        // Após a validação das tags e seus SingleService gerados. Vou organizar pra prepar o envio do pacote ENIP

        // Defino o maximo de bytes que vai pode haver na requisição ENIP
        const maximoBytesENIP = 512;

        // Total em bytes que os serviços de escrita vão ocupar
        let totalBytesDeServices = 0;

        // --------- Tamanho do cabeçalho ENIP ---------
        let totalBytesCabecalho = 0;
        // Pegar o tamanho base em bytes de todo o pacote ENIP 
        let bufferLayerCIPAtual = layerENIP.criarBuffer();
        if (!bufferLayerCIPAtual.isSucesso) {
            retornoEscrita.erro.descricao = `Erro ao gerar o buffer do Layer ENIP para determinar o tamanho base em bytes: ${bufferLayerCIPAtual.erro.descricao}. Trace log: ${bufferLayerCIPAtual.tracer.getHistoricoOrdenado().join(' -> ')}`;
            return retornoEscrita;
        }

        // Adicionar os bytes do cabeçalho ENIP
        totalBytesCabecalho = bufferLayerCIPAtual.sucesso.buffer.length;
        // ----------------

        // Array que vai armazenar os tags que vão ser enviados em outro ENIP caso ultrapasse o limite de bytes no ENIP atual

        /**
         * @type {EscritaTag[]}
         */
        const tagsParaSepararEmOutroENIP = []

        // Ordenar as tags de escrita por menor tamanho em bytes
        tagsValidasDeEscrita.sort((a, b) => a.tamanhoServicePacket - b.tamanhoServicePacket);
        for (const singleServiceEscrita of tagsValidasDeEscrita) {

            // + os bytes totais desse serviço
            totalBytesDeServices += singleServiceEscrita.tamanhoServicePacket;

            // + 2 bytes do offset do serviço no cabeçalho
            totalBytesCabecalho += 2

            // Se o total de bytes ultrapassar o maximo permitido, devo adicionar no array que envia outro ENIP com as tags restantes
            if (totalBytesCabecalho + totalBytesDeServices > maximoBytesENIP) {

                tagsParaSepararEmOutroENIP.push({
                    tag: singleServiceEscrita.tagObjeto.tag,
                    dataType: {
                        isAtomico: singleServiceEscrita.tagObjeto.dataTypeDados.isAtomico,
                        atomico: {
                            codigoAtomico: singleServiceEscrita.tagObjeto.dataTypeDados.atomico.codigoAtomico,
                            valor: singleServiceEscrita.tagObjeto.dataTypeDados.atomico.valor
                        },
                        isStruct: singleServiceEscrita.tagObjeto.dataTypeDados.isStruct,
                        struct: {
                            codigoStruct: singleServiceEscrita.tagObjeto.dataTypeDados.struct.codigoStruct,
                            classeStruct: singleServiceEscrita.tagObjeto.dataTypeDados.struct.classeStruct
                        }
                    }
                });
                continue;
            }

            // Se ainda não ultrapassou o limite, adicionar o serviço no ENIP atual
            layerMultipleService.addSingleServicePacket(singleServiceEscrita.servicePacket);
        }

        // Finalmente após as verificações, enviar o pacote enip com as tags disponiveis
        const respostaEscritaENIP = await this.getENIPSocket().enviarENIP(layerENIP);

        if (!respostaEscritaENIP.isSucesso) {

            // Erro inicial ao enviar o pacote ENIP. Provavelmente nem chegou a ser enviado ao dispositivo
            if (!respostaEscritaENIP.enipEnviar.isEnviou) {
                retornoEscrita.erro.descricao = `Erro ao enviar o pacote ENIP de escrita de tags: ${respostaEscritaENIP.enipEnviar.erro.descricao}}. ${respostaEscritaENIP.enipEnviar.erro.isGerarBuffer ? `Trace Log: ${respostaEscritaENIP.enipEnviar.erro.erroGerarBuffer.traceLog}` : ''}`;
                return retornoEscrita;
            }

            // Erro se o pacote ENIP foi enviado, porém não devolveu a resposta
            if (!respostaEscritaENIP.enipReceber.isRecebeu) {
                retornoEscrita.erro.descricao = `Erro ao receber a resposta do pacote ENIP de escrita de tags: ${respostaEscritaENIP.enipReceber.erro.descricao}}.`;
                return retornoEscrita;
            }
        }

        // Se chegou aqui, o pacote ENIP foi enviado e recebido com sucesso
        const ENIPResposta = respostaEscritaENIP.enipReceber.enipParser;

        // Validar se o Buffer recebido é valido
        if (!ENIPResposta.isValido().isValido) {
            retornoEscrita.erro.descricao = `O pacote ENIP recebido não é valido, alguma informação no Buffer está incorreta: ${ENIPResposta.isValido().erro.descricao}`;
            retornoEscrita.erro.isENIPInvalido = true;
            retornoEscrita.erro.ENIPInvalido.trace = ENIPResposta.isValido().tracer.getHistoricoOrdenado();
            return retornoEscrita;
        }

        // Ok, se o Buffer for valido, checar se veio com o status de sucesso
        if (!ENIPResposta.isStatusSucesso().isSucesso) {
            retornoEscrita.erro.descricao = `O pacote ENIP recebido não retornou com sucesso: ${ENIPResposta.getStatus().codigo} - ${ENIPResposta.getStatus().mensagem}`;
            retornoEscrita.erro.isENIPStatusErro = true;
            retornoEscrita.erro.ENIPStatusErro.codigo = ENIPResposta.getStatus().codigo;
            retornoEscrita.erro.ENIPStatusErro.descricao = ENIPResposta.getStatus().mensagem;

            return retornoEscrita;
        }

        // Se o pacote ENIP não é um SendRRData, então não é o pacote que espero
        if (!ENIPResposta.isSendRRData()) {
            retornoEscrita.erro.descricao = 'O pacote de resposta não é um comando SendRRData';
            return retornoEscrita;
        }

        // Informações do comando SendRRData recebido
        const ENIPSendRRData = ENIPResposta.getAsSendRRData();

        // Validar se o Buffer recebido é valido
        if (!ENIPSendRRData.isValido().isValido) {

            retornoEscrita.erro.descricao = `O pacote SendRRData não é valido, alguma informação no Buffer está incorreta: ${ENIPSendRRData.isValido().erro.descricao}. Trace log: ${ENIPSendRRData.isValido().tracer.getHistoricoOrdenado().join(' -> ')}`;
            return retornoEscrita;
        }

        // Por enquanto só suporta CIP, então preciso garantir que a resposta usa o serviço CIP
        if (!ENIPSendRRData.isServicoCIP()) {
            retornoEscrita.erro.descricao = 'O pacote de resposta não é um serviço CIP';
            return retornoEscrita;
        }

        // Obter as informações do serviço CIP, que vai conter as informações de escrituras das tags
        const ENIPCIP = ENIPSendRRData.getAsServicoCIP();

        // Validar se o CIP é valido
        if (!ENIPCIP.isValido().isValido) {
            retornoEscrita.erro.descricao = `O pacote CIP não é valido, alguma informação no Buffer está incorreta: ${ENIPCIP.isValido().erro.descricao}. Trace log: ${ENIPCIP.isValido().tracer.getHistoricoOrdenado().join(' -> ')}`;
            return retornoEscrita;
        }

        // Se o status do CIP for != de sucesso, é necessario analisar o erro, pois alguns são fatais e outros não
        if (ENIPCIP.getStatusCIP().codigo != CIPGeneralStatusCodes.Success.hex) {

            /**
             * O erro é somente fatal se impediu completamente todas as operações solicitadas. O cabeçalho de status da erro se pelo menos algum item deu erro, mesmo quando
             * outros itens deram sucesso, então precisa analisar exatamente o erro ocorrido
             */
            let isErroFatal = false;

            switch (ENIPCIP.getStatusCIP().codigo) {
                // Esse erro só acontece se foi informado alguma tag nos Service Packets que não existe. Não é um erro fatal e não influencia os outros service packets
                case CIPGeneralStatusCodes.PathSegmentError.hex: {
                    break;
                }
                // Esse erro acontece com algum outro erro em algum Service Packet enviado que não seja o path segment error. Também não é um erro fatal.
                case CIPGeneralStatusCodes.EmbeddedServiceError.hex: {
                    break
                }
                // Para qualquer outro erro, vou setar como fatal para garantir
                default: {
                    retornoEscrita.erro.descricao = `O pacote CIP retornou com o status ${ENIPCIP.getStatusCIP().codigo}: ${ENIPCIP.getStatusCIP().descricao} `;
                    isErroFatal = true;
                    break;
                }
            }

            if (isErroFatal) {
                return retornoEscrita;
            }
        }

        // Validar se foi retornado a resposta correspodente a um CIP Connection Manager
        const CIPConnectionManager = ENIPCIP.getAsConnectionManager();
        if (!CIPConnectionManager.isValido().isValido) {

            retornoEscrita.erro.descricao = `O pacote CIP Connection Manager não é valido, alguma informação no Buffer está incorreta: ${CIPConnectionManager.isValido().erro.descricao}. Trace log: ${CIPConnectionManager.isValido().tracer.getHistoricoOrdenado().join(' -> ')}`;
            return retornoEscrita;
        }

        // Validado o status do CIP, obrigatoriamente o retorno precisa ser um serviço Multiple Service Packet com o retorno de status das escritas
        if (!CIPConnectionManager.isMultipleServicePacket()) {

            retornoEscrita.erro.descricao = 'O pacote de resposta não contém um Multiple Service Packet';
            return retornoEscrita;
        }

        // Obter o Multiple Service Packet que contém as informações das escritas das tags
        const ENIPMultipleService = CIPConnectionManager.getAsMultipleServicePacket();
        if (!ENIPMultipleService.isValido().isValido) {
            retornoEscrita.erro.descricao = `O pacote Multiple Service Packet não é valido, alguma informação no Buffer está incorreta: ${ENIPMultipleService.isValido().erro.descricao}. Trace log: ${ENIPMultipleService.isValido().tracer.getHistoricoOrdenado().join(' -> ')}`;

            return retornoEscrita;
        }

        // Iterar sobre todos os Service Packets retornados na resposta e bater com a sequencia de tags que foram enviadas para identificar
        // O status de cada uma
        for (let indexServiceCIP = 0; indexServiceCIP < ENIPMultipleService.getServicesPackets().length; indexServiceCIP++) {

            // Obter o Service Packet atual
            const CIPPacket = ENIPMultipleService.getServicesPackets()[indexServiceCIP];

            // Obter a solicitação de escrita da tag do array.
            const tagEscritaSolicitada = tagsValidasDeEscrita[indexServiceCIP];

            // Ambas variaveis devem estar sincronizadas com o array nas mesmas posições, já que foi usado o sort pra ordenar ANTES de enviar os Single Service Packets ao ENIP
            // Se não estiver em ordem então o universo não faz sentido
            if (tagEscritaSolicitada == undefined) continue;

            // Validar se o CIP recebido foi validado
            if (!CIPPacket.isValido().isValido) {

                tagEscritaSolicitada.tagObjeto.erro.descricao = `O pacote CIP não é valido, alguma informação no Buffer está incorreta: ${CIPPacket.isValido().erro.descricao}`;
                tagEscritaSolicitada.tagObjeto.erro.isCIPInvalido = true;
                tagEscritaSolicitada.tagObjeto.erro.CIPInvalido.trace = CIPPacket.isValido().tracer.getHistoricoOrdenado();

                continue;
            }

            // O CIP Connection Manager contém o Single Service Packet
            const CIPConnectionManager = CIPPacket.getAsConnectionManager();
            if (!CIPConnectionManager.isValido().isValido) {
                tagEscritaSolicitada.tagObjeto.erro.descricao = `O pacote CIP Connection Manager não é valido, alguma informação no Buffer está incorreta: ${CIPConnectionManager.isValido().erro.descricao}`;
                tagEscritaSolicitada.tagObjeto.erro.isCIPInvalido = true;
                tagEscritaSolicitada.tagObjeto.erro.CIPInvalido.trace = CIPConnectionManager.isValido().tracer.getHistoricoOrdenado();

                continue;
            }

            // O CIP é pra conter somente um Single Service Packet com o status da escrita da tag
            if (!CIPConnectionManager.isSingleServicePacket()) {

                tagEscritaSolicitada.tagObjeto.erro.descricao = `O pacote de resposta não contém um SIngle Service Packet`
                tagEscritaSolicitada.tagObjeto.erro.isSingleServicePacketNaoRetornado = true;

                continue;
            }

            // Obter o Single Service Packet que contém o status da escrita da tag
            const singleServicePacket = CIPConnectionManager.getAsSingleServicePacket();

            // Validar se o Single Service Packet é valido
            if (!singleServicePacket.isValido().isValido) {

                tagEscritaSolicitada.tagObjeto.erro.descricao = `O pacote Single Service Packet não é valido, alguma informação no Buffer está incorreta: ${singleServicePacket.isValido().erro.descricao}`;
                tagEscritaSolicitada.tagObjeto.erro.isSingleServicePacketInvalido = true;
                tagEscritaSolicitada.tagObjeto.erro.singleServicePacketInvalido.trace = singleServicePacket.isValido().tracer.getHistoricoOrdenado();

                continue;
            }

            // Se o Buffer for valido, validar agora o status retornado 
            if (!singleServicePacket.isStatusSucesso().isSucesso) {

                // Anotar o erro retornado na tag
                tagEscritaSolicitada.tagObjeto.erro.isSingleServicePacketStatusErro = true;
                tagEscritaSolicitada.tagObjeto.erro.SingleServicePacketStatusErro.codigoStatus = singleServicePacket.getStatus().codigoStatus;
                tagEscritaSolicitada.tagObjeto.erro.SingleServicePacketStatusErro.descricaoStatus = singleServicePacket.getStatus().descricaoStatus;
                tagEscritaSolicitada.tagObjeto.erro.SingleServicePacketStatusErro.additionalStatusBuffer = singleServicePacket.getStatus().additionalStatusCode.buffer;

                switch (singleServicePacket.getStatus().codigoStatus) {
                    // Path Segment Error acontece se a tag informada não existe
                    case CIPGeneralStatusCodes.PathSegmentError.hex: {
                        tagEscritaSolicitada.tagObjeto.erro.descricao = `A tag solicitada não existe no controlador`;
                        tagEscritaSolicitada.tagObjeto.erro.SingleServicePacketStatusErro.isTagNaoExiste = true;
                        continue;
                    }
                    // Ainda não sei outros tipos de erros que podem ocorrer, então qualquer status != de sucesso eu trato como erro na escrita
                    default: {

                        tagEscritaSolicitada.tagObjeto.erro.descricao = `O pacote Single Service Packet retornou um status de erro: ${singleServicePacket.getStatus().codigoStatus} - ${singleServicePacket.getStatus().descricaoStatus}`;

                        let bufferAdditionalStatus = singleServicePacket.getStatus().additionalStatusCode.buffer;
                        if (bufferAdditionalStatus != undefined) {
                            let codigoErroExtra = bufferAdditionalStatus.readUInt16LE(0);

                            switch (codigoErroExtra) {
                                // Se o erro extra for 0x2107, significa que o data type informado pra tag é incorreto
                                case 8455: {
                                    tagEscritaSolicitada.tagObjeto.erro.SingleServicePacketStatusErro.isDataTypeIncorreto = true;
                                    tagEscritaSolicitada.tagObjeto.erro.descricao += `/ Data Type informado para a tag é incorreto`;
                                    break;
                                }
                                default:
                                    tagEscritaSolicitada.tagObjeto.erro.descricao += `/ Additional Status Code retornado: ${codigoErroExtra}`;
                                    break;
                            }
                        }

                        continue
                    }
                }
            }

            // Se chegou aqui, a escrita da tag foi realizada com sucesso com status de sucesso
            tagEscritaSolicitada.tagObjeto.isSucesso = true;
        }

        // ----------------- Verificação de tags que precisam ser enviadas em outro ENIP -----------------
        // Ok, agora que verifiquei as informações das tags no ENIP atual, verificar se tem tags que precisam ser enviadas em outro ENIP
        if (tagsParaSepararEmOutroENIP.length > 0) {

            // Isso causará um efeito em cascata para escritas de novas tags se as chamadas subsequentes precisarem dividir as escritas em mais chamados, e ta tudo bem!
            const retornoEscritaOutroENIP = await this.escreveMultiplasTags(tagsParaSepararEmOutroENIP);

            if (!retornoEscritaOutroENIP.isSucesso) {
                // Se não deu sucesso, nenhuma das tags foi escrita com sucesso

                // Gravar o erro nas tags separadas
                for (const tagEscritaErro of tagsParaSepararEmOutroENIP) {
                    const refOriginalTag = tagsPendenteEscrita.find(t => t.tagObjeto.tag == tagEscritaErro.tag);
                    if (refOriginalTag == undefined) continue;

                    // Anotar o erro
                    refOriginalTag.tagObjeto.erro.descricao = `Erro ao solicitar escritura da tag: ${retornoEscritaOutroENIP.erro.descricao}`;
                    refOriginalTag.tagObjeto.erro.isCIPNaoRetornado = true;
                }
            } else {

                // Se a leitura deu certo, atualizar as tags com as informações de escrita recebida
                for (const tagEscritaSucesso of retornoEscritaOutroENIP.sucesso.tags) {

                    const refOriginalTag = tagsPendenteEscrita.find(t => t.tagObjeto.tag == tagEscritaSucesso.tag);
                    if (refOriginalTag == undefined) continue;

                    Object.assign(refOriginalTag.tagObjeto, tagEscritaSucesso);
                }
            }
        }

        // -----------------------------------------------------------

        retornoEscrita.isSucesso = true;
        retornoEscrita.sucesso.tags = tagsPendenteEscrita.map((t) => t.tagObjeto);

        return retornoEscrita;
    }

    /**
     * Solicita a lista de todas as tags disponiveis no controlador CompactLogix.
     * @param {Object} parametros - Alguns parametros opcionais
     * @param {Number} parametros.instanciaOffset - A busca das tags é iniciado da instancia 0 até o limite de tags disponiveis. Se informado um valor, a busca começa a partir da instancia informada.
     */
    async obterListaDeTags(parametros) {
        /**
         * Informações da tag
         * @typedef TagInfo
         * @property {String} tag - Nome da tag
         * @property {Number} instancia - Instancia de offset da tag na memoria do controlador
         * @property {Object} dataType - Detalhes do data type da tag(se é atomico, struct, etc)
         * @property {Boolean} dataType.isDataTypeSuportado - Se o data type da tag é suportado
         * @property {Object} dataType.dataTypeNaoSuportado - Se isDataTypeSuportado for false, contém detalhes do data type recebido.
         * @property {Number} dataType.dataTypeNaoSuportado.codigo - Código do Data Type não suportado
         * @property {String} dataType.dataTypeNaoSuportado.descricao - Descrição com alguns detalhes do Data Type não suportado
         * @property {Boolean} dataType.isAtomico - Se o Data Type é atomico(numeros, bit, booleano)
         * @property {Boolean} dataType.isStruct - Se o Data Type é uma struct
         * @property {DataTypeTagAtomico | DataTypeTagStruct} dataType.classeDataType - Essa informação é dinamica dependendo do tipo da tag, contém os detalhes da tag.
         */

        const retornoTags = {
            /**
             * Se foi possível obter a lista de tags com sucesso
             */
            isSucesso: false,
            /**
             * Se sucesso, contém detalhes das tags ou outras informações adicionais
             */
            sucesso: {
                /**
                 * Informações das tags encontradas
                 * @type {TagInfo[]}
                 */
                tags: []
            },
            /**
             * Se não deu pra obter a lista de tags, contém detalhes do erro
             */
            erro: {
                descricao: ''
            }
        }

        let novoPacoteENIP = this.getENIPSocket().getNovoLayerBuilder();

        // Prepara os layers de encapsulamentos
        const sendRRData = novoPacoteENIP.buildSendRRData();

        // Serviço CIP
        const servicoCIP = sendRRData.criarServicoCIP();

        // Como é uma Unconnected Message, instancio o Connection Manager pra acessar as informações de classe e instancia
        const connMan = servicoCIP.buildCIPConnectionManager()

        // Crio o serviço de solicitar a leitura da tag
        const sondaClasseTags = connMan.getCIPMessage().buildServicoCustomizadoPacket();

        // Código de serviço 0x55 e a classe 0x6b não achei informações sobre, só sei que ele permite navegar pelas classes e instancias das tags do controlador
        sondaClasseTags.setCodigoServico(0x55)
        sondaClasseTags.setClasse(Buffer.from([0x20, 0x6b]))

        // O CIP Generic Data eu informo a quantidade de atributos que vou buscar, e quais atributos quero
        // Os primeiros 2 bytes é a quantidade de atributos pra retornar
        // Próximos a cada 2 bytes é um ID do atributo.
        // 0x01 0x00 = Atributo 1 = Nome da Tag
        // 0x02 0x00 = Atributo 2 = Tipo de Dado da Tag
        sondaClasseTags.setCIPGenericData(Buffer.from([0x02, 0x00, 0x01, 0x00, 0x02, 0x00]))

        // Configurar o Request Path da Instancia
        // 0x25 = Logical Segment / Type Instance ID / Formato 16 bit
        const bufferSegmento = Buffer.from([0x25, 0x00])

        // Cada tag no controlador tem um código de instancia que indica sua posição. A instancia 0 retorna o inicio das primeiras tags até um certo limite onde inicia a proxima tag.
        // Por exemplo a instancia 0 armazena a tag TESTE, a proxima tag não é armazenada incremental exatamente no 1, vai ser um valor maior, por exemplo 7, que poderia ser a tag LEGAL.
        // Então a instancia 0 retorna a tag TESTE, e a instancia 7 retorna a tag LEGAL.
        // Se for solicitado a instancia de 0 até 6, vai retornar somente a tag TESTE, como se fosse uma região de memoria onde do 0 até o 6 pertence a tag TESTE, e do 7 até a proxima x instancia seria a tag LEGAL.

        // Aqui eu salvo a ultima instancia da solicitação. Cada solicitação retorna o maximo de tags que cabe no pacote CIP, a ultima tag no pacote eu salvo a instancia ID e uso pra solicitar as proximas a partir dela, até não ter mais nenhuma(retorna Sucess ao invés de Partial Transfer)
        let ultimaInstanciaId = 0;
        if (parametros != undefined) {
            if (parametros.instanciaOffset != undefined) {
                if (isNaN(parametros.instanciaOffset)) {
                    throw new Error('O valor do offset da instancia deve ser um número');
                }

                ultimaInstanciaId = parseInt(parametros.instanciaOffset);
            }
        }

        // Senior developer
        while (true) {

            // Definir o offset do inicio da instancia para retornar as próximas tags
            let bufferInstancia = Buffer.alloc(2);
            bufferInstancia.writeUInt16LE(ultimaInstanciaId);

            sondaClasseTags.setInstancia(Buffer.concat([bufferSegmento, bufferInstancia]));
            let respostaENIP = await this.getENIPSocket().enviarENIP(novoPacoteENIP);

            // Se ocorreu algum erro no envio <-> recebimento do ENIP
            if (!respostaENIP.isSucesso) {

                // Se não foi enviado
                if (!respostaENIP.enipEnviar.isEnviou) {

                    retornoTags.erro.descricao = `Erro ao enviar o pacote ENIP de solicitação de tags: ${respostaENIP.enipEnviar.erro.descricao}. ${respostaENIP.enipEnviar.erro.isGerarBuffer ? `Trace Log: ${respostaENIP.enipEnviar.erro.erroGerarBuffer.traceLog}` : ''}`;
                    return retornoTags;
                }

                // Se foi enviado, porém não recebeu a resposta
                if (!respostaENIP.enipReceber.isRecebeu) {

                    retornoTags.erro.descricao = `Erro ao receber a resposta do pacote ENIP de solicitação de tags: ${respostaENIP.enipReceber.erro.descricao}.`;
                    return retornoTags;
                }
            }

            // Ok, o envio e recebimento estão oks, verificar se foi retornado a resposta válida
            let enipLayerParser = respostaENIP.enipReceber.enipParser;
            if (!enipLayerParser.isValido().isValido) {
                retornoTags.erro.descricao = `O pacote ENIP recebido não é valido, alguma informação no Buffer está incorreta: ${enipLayerParser.getStatus().codigo} - ${enipLayerParser.getStatus().mensagem}`;

                return retornoTags;
            }

            // Validar se o ENIP retornou sucesso
            if (!enipLayerParser.isStatusSucesso().isSucesso) {
                retornoTags.erro.descricao = `O pacote ENIP retornou com o status ${enipLayerParser.getStatus().codigo}: ${enipLayerParser.getStatus().mensagem}`;

                return retornoTags;
            }

            // O comando recebido precisa ser o SendRRData
            if (!enipLayerParser.isSendRRData()) {
                retornoTags.erro.descricao = 'O pacote de resposta não é um comando SendRRData';
                return retornoTags;
            }

            const sendRRDataParser = enipLayerParser.getAsSendRRData();

            // Validar se o SendRRData é valido
            if (!sendRRDataParser.isValido().isValido) {

                retornoTags.erro.descricao = `O pacote SendRRData não é valido, alguma informação no Buffer está incorreta: ${sendRRDataParser.isValido().erro.descricao}. Trace log: ${sendRRDataParser.isValido().tracer.getHistoricoOrdenado().join(' -> ')}`;
                return retornoTags;
            }

            // Se SendRRData é valido, validar se foi retornado o encapsulamento CIP com os dados das tags
            if (!sendRRDataParser.isServicoCIP()) {
                retornoTags.erro.descricao = 'O pacote de resposta não é um serviço CIP';
                return retornoTags;
            }

            const servicoCIPParser = sendRRDataParser.getAsServicoCIP();

            // Validar se o CIP é valido
            if (!servicoCIPParser.isValido().isValido) {
                retornoTags.erro.descricao = `O pacote CIP não é valido, alguma informação no Buffer está incorreta: ${servicoCIPParser.isValido().erro.descricao}. Trace log: ${servicoCIPParser.isValido().tracer.getHistoricoOrdenado().join(' -> ')}`;
                return retornoTags;
            }

            const servicoAsConnectionManager = servicoCIPParser.getAsConnectionManager();

            // Obter a classe como generica pois eu vou tratar os dados manualmente.
            const servicoGenericoPacket = servicoAsConnectionManager.getAsServicoGenericoPacket();

            if (!servicoGenericoPacket.isValido().isValido) {
                retornoTags.erro.descricao = `O pacote de resposta não é um serviço generico não é valido, alguma informação no Buffer está incorreta: ${servicoGenericoPacket.isValido().erro.descricao}. Trace log: ${servicoGenericoPacket.isValido().tracer.getHistoricoOrdenado().join(' -> ')}`;
                return retornoTags;
            }

            // Verificar se a requisição teve um status valido que retornou algo valido. Pra ser valido, tem que ser Sucess ou Partial Transfer, ambos retornam dados validos, se for qualquer outro status, é erro.
            if (servicoGenericoPacket.getStatus().codigoStatus != CIPGeneralStatusCodes.Success.hex && servicoGenericoPacket.getStatus().codigoStatus != CIPGeneralStatusCodes.PartialTransfer.hex) {
                retornoTags.erro.descricao = `O pacote CIP retornou com o status ${servicoGenericoPacket.getStatus().codigoStatus}: ${servicoGenericoPacket.getStatus().descricaoStatus} ao obter as tags a partir da instancia ${ultimaInstanciaId}.`;

                return retornoTags;
            }

            // Beleza, todas as informações validadas, vou ter o CIP Generic Data que contém as informações das tags
            const bufferCIPGenericData = servicoGenericoPacket.getCIPClassCommandSpecificData();

            // Trata os 2 bytes do data type pra retornar o tipo correto
            const parseDataType = (tipo) => {
                let typeCode = null;
                if ((tipo & 0x00ff) === 0xc1) {
                    typeCode = 0x00c1;
                }
                else {
                    typeCode = tipo & 0x0fff;
                }

                return typeCode;
            }

            // O Buffer vai conter uma sequencia de bytes que contém as informações das tags. 0 começa o inicio de informações da 1 tag
            // Baseado no CIP que enviei solicitando 2 atributos, a sequencia de informações de cada tag é:
            /**
             * 4 Bytes = Instancia ID
             * 2 Bytes = Tamanho do nome da tag
             * x Bytes = Nome da tag
             * 2 Bytes = Data Type da tag
             */

            let offsetTag = 0;
            while (offsetTag < bufferCIPGenericData.length) {

                // Primeiros 4 bytes é a instancia ID da tag atual
                const instanciaIDTag = bufferCIPGenericData.readUInt32LE(offsetTag);

                ultimaInstanciaId = instanciaIDTag + 1;

                // Proximos 2 bytes é o tamanho da tag
                offsetTag += 4;
                const tamanhoTag = bufferCIPGenericData.readUInt16LE(offsetTag);

                offsetTag += 2;
                // Proximos x bytes é o nome da tag
                const nomeTag = bufferCIPGenericData.subarray(offsetTag, offsetTag + tamanhoTag).toString();

                offsetTag += tamanhoTag;
                // Proximos 2 bytes é o Data Type da tag
                const dataTypeTag = bufferCIPGenericData.readUInt16LE(offsetTag);

                // Aumentar 2 bytes pra iniciar na próxima tag
                offsetTag += 2;

                /**
                 * Armazenar a tag encontrada
                 * @type {TagInfo}
                 */
                const tagTypeDetalhe = {
                    tag: nomeTag,
                    instancia: instanciaIDTag,
                    dataType: {
                        classeDataType: {},
                        isAtomico: false,
                        isStruct: false,
                        isDataTypeSuportado: false,
                        dataTypeNaoSuportado: {
                            codigo: undefined
                        }
                    }
                }

                const dataTypeConvertido = parseDataType(dataTypeTag)

                // Obter o data type da tag(se é atomico, struct..)
                const dataType = this.getTipoDataType(dataTypeConvertido);

                if (dataType.isAtomico) {
                    // Se atomico

                    tagTypeDetalhe.dataType.isAtomico = true;
                    tagTypeDetalhe.dataType.isDataTypeSuportado = true;
                    tagTypeDetalhe.dataType.classeDataType = this.getDataTypeAtomico(dataTypeConvertido);
                } else if (dataType.isStruct) {
                    // Se Struct

                    switch (dataTypeConvertido) {

                        // Se for uma struct ASCII String 82
                        case DataTypes.structs.ASCIISTRING82.codigoTipoStruct: {
                            tagTypeDetalhe.dataType.isStruct = true;
                            tagTypeDetalhe.dataType.isDataTypeSuportado = true;
                            tagTypeDetalhe.dataType.classeDataType = this.getDataTypeStruct(dataTypeConvertido);
                            break;
                        }
                        // Se for uma struct que ainda não há suporte
                        default: {
                            tagTypeDetalhe.dataType.dataTypeNaoSuportado.codigo = dataTypeConvertido;
                            tagTypeDetalhe.dataType.dataTypeNaoSuportado.descricao = `Data Type é um Struct porém ainda não há suporte para esse tipo.`;
                            break;
                        }
                    }

                } else {

                    // Se ainda não for suportado, adiciono o tipo original recebido
                    tagTypeDetalhe.dataType.dataTypeNaoSuportado.codigo = dataTypeConvertido;
                    tagTypeDetalhe.dataType.dataTypeNaoSuportado.descricao = `Data Type não é atomico e nem struct.`;
                }

                retornoTags.sucesso.tags.push(tagTypeDetalhe);
            }

            // Depois de analisar o Buffer, verificar se ainda preciso solicitar mais instancias ou se já cheguei ao fim.

            // Se retornou o status 0, é porque não tem mais tags pra retornar
            if (servicoGenericoPacket.getStatus().codigoStatus == CIPGeneralStatusCodes.Success.hex) {
                break;
            }

            // Se não for sucesso, é Partial Transfer, então preciso solicitar mais tags no proximo loop
        }

        retornoTags.isSucesso = true;
        return retornoTags;
    }

    /**
     * Retorna os Data Types disponiveis do controlador CompactLogix
     */
    getDataTypes() {
        return DataTypes;
    }

    /**
     * Retorna informações de um Data Type atomico
     * @param {Number} codigo 
     * @returns {DataTypeTagAtomico}
     */
    getDataTypeAtomico(codigo) {
        return Object.values(DataTypes.atomicos).find((type) => type.codigo == codigo);
    }

    /**
     * Retorna se um Data Type ta no range pra ser um tipo atomico(numero)
     */
    isDataTypeAtomico(tipo) {
        return Object.values(DataTypes.atomicos).some((type) => type.codigo == tipo);
    }

    /**
     * Retorna informações de um Data Type do tipo Struct 672
     * @param {Number} codigoStruct - Código especifico do Struct
     */
    getDataTypeStruct(codigoStruct) {
        return Object.values(DataTypes.structs).find((type) => type.codigoTipoStruct == codigoStruct);
    }

    /**
     * Retorna se um Data Type especifico do Struct pertence ao tipo Struct
     * @param {Number} codigoStruct
     */
    isDataTypeStruct(codStruct) {
        return Object.values(DataTypes.structs).some((type) => type.codigoTipoStruct == codStruct);
    }

    /**
     * Retorna se um código de Data Type é do tipo Struct(672)
     * @param {Number} codigo 
     */
    isStruct(codigo) {
        return codigo == 672;
    }

    /**
     * Retorna o tipo de dado de um Data Type
     * @param {Number} codigo - Código para verificar, podendo ser um Data Type Atomico ou um Data Type Struct 
     */
    getTipoDataType(codigo) {
        const dataTipo = {
            isAtomico: false,
            isStruct: false
        }

        if (codigo >= 192 && codigo <= 202) {
            if (this.isDataTypeAtomico(codigo)) {
                dataTipo.isAtomico = true;
            }
        } else if (codigo == 672 || this.isDataTypeStruct(codigo)) {
            dataTipo.isStruct = true;
        }

        return dataTipo;
    }

    /**
     * Converte um buffer de CIP Class Generic que contém o valor de uma tag para o valor do tipo de dado
     ** Um Buffer de Data Type é geralmente dinamico dependendo do tipo, porém por padrão os 2 bytes inicias sempre são o tipo correspondente do Data Type do valor.
     * @param {Buffer} buffer - Buffer para converter
     */
    #converteDataTypeToValor(buffer) {
        let retornoConverte = {
            /**
             * Se foi possível converter o valor com sucesso
             */
            isConvertido: false,
            /**
             * Se sucesso, contém detalhes do valor convertido
             */
            conversao: {
                /**
                 * Se o valor é atomico(Data Types do range 193 até 197, que são os numeros, int, double, real, etc..)
                 */
                isAtomico: false,
                /**
                 * Se é um valor atomico, contém os dados do valor 
                 */
                atomico: {
                    /**
                     * Valor
                     * @type {Number}
                     */
                    valor: undefined,
                    /**
                     * Detalhes do tipo do valor, se é inteiro, double int, etc...
                     * @type {DataTypeTagAtomico}
                     */
                    dataType: undefined
                },
                /**
                 * Se o valor é um Struct(Data Type 672, que é para Strings, Timers, etc.. tudo que é mais complexo que um simples numero)
                 */
                isStruct: false,
                /**
                 * Detalhes da Struct com seus dados.
                 */
                struct: {
                    /**
                     * Esse campo é dinamico dependendo do tipo da Struct, utilize o dataType para verificar o tipo se vc não sabe qual o tipo foi recebido
                     * @type {DataTypeTagStructASCIIString82}
                     */
                    structData: undefined,
                    /**
                     * Detalhes do tipo da Struct
                     * @type {DataTypeTagStruct}
                     */
                    dataType: undefined
                }
            },
            /**
             * Se não deu pra converter o valor, contém detalhes do erro
             */
            erro: {
                descricao: ''
            }
        }

        // Se o buffer não tiver pelo menos 2 bytes, não tem como ser um buffer de Data Type
        if (buffer.length <= 2) {
            retornoConverte.erro.descricao = 'O buffer não contém pelo menos 2 bytes para ser um buffer de Data Type';
            return retornoConverte;
        }

        // Os primeiro 2 byte é o Tipo de Dado
        const IdDataType = buffer.readUInt16LE(0);

        let dataTypeDetalhe = this.getTipoDataType(IdDataType);
        if (dataTypeDetalhe.isAtomico) {

            // No caso de tipos numericos, os restantes dos bytes após os 2 bytes do tipo são os bytes do numero
            const detalhesDataType = this.getDataTypeAtomico(IdDataType);
            if (detalhesDataType == undefined) {
                retornoConverte.erro.descricao = `Tipo de Data Type numerico não encontrado: ${IdDataType} `;
                return retornoConverte;
            }

            // Realizar a tratativa pro valor numerico, que é a leitura do buffer a partir do 4 byte, até x bytes do tamanho do numero.
            let valorContidoNoDataType = buffer.readUIntLE(2, detalhesDataType.tamanho);

            retornoConverte.isConvertido = true;

            retornoConverte.conversao.isAtomico = true;

            // Se tipo for bool, fazer uma tratativa pra mostar 0 e 1. Os tipos booleanos no Compact retornam 0 pra false e 255 pra true
            if (detalhesDataType.codigo == 193) {
                retornoConverte.conversao.atomico.valor = valorContidoNoDataType == 0 ? 0 : 1;
            } else {
                retornoConverte.conversao.atomico.valor = valorContidoNoDataType;
            }
            retornoConverte.conversao.atomico.dataType = detalhesDataType;

            return retornoConverte;
        } else if (dataTypeDetalhe.isStruct) {

            // No caso de Structs, os próximos 2 bytes indicam o tipo especifico da Struct
            const tipoDaStruct = buffer.readUInt16LE(2);

            // Pegar as informações da Struct
            const detalhesStruct = this.getDataTypeStruct(tipoDaStruct);
            if (detalhesStruct == undefined) {
                retornoConverte.erro.descricao = `Tipo de Data Type Struct não encontrado: ${tipoDaStruct} `;
                return retornoConverte;
            }

            // Aplicar uma trativa diferente para cada tipo de Struct já que cada uma tem um formato diferente
            switch (detalhesStruct.codigoTipoStruct) {

                // Tipo de Struct para String ASCII de 82 bytes
                case DataTypes.structs.ASCIISTRING82.codigoTipoStruct: {

                    // Próximos 1 byte é o tamanho real total de caracteres na string
                    const tamanhoRealString = buffer.readUInt8(4);

                    // Os próximos 3 bytes depois do tamanho são 3 bytes vazios, não sei oq mas as informações da string vem depois disso
                    const conteudoString = buffer.subarray(8, 8 + tamanhoRealString).toString('utf8');

                    /**
                     * @type {DataTypeTagStructASCIIString82}
                     */
                    let typeValor = {
                        stringConteudo: conteudoString,
                        tamanho: tamanhoRealString
                    }

                    retornoConverte.isConvertido = true;
                    retornoConverte.conversao.isStruct = true;
                    retornoConverte.conversao.struct.dataType = detalhesStruct;
                    retornoConverte.conversao.struct.structData = typeValor;
                    return retornoConverte;
                }

                // Para tipos ainda não suportados ou desconhecidos
                default: {

                    retornoConverte.erro.descricao = `Tipo de Data Type Struct não suportado ou desconhecido: ${tipoDaStruct} `;
                    return retornoConverte;
                }
            }
        } else {

            // Se não achou o tipo, deve ser um tipo não suportado ou inválido
            retornoConverte.erro.descricao = `Tipo de Data Type não suportado ou desconhecido: ${IdDataType} `;
            return retornoConverte;
        }

    }

    /**
     * Logar uma mensagem
     * @param {String} msg 
     */
    log(msg) {
        this.#estado.emissorEvento.disparaEvento('log', msg);
        if (!this.#configuracao.logs.habilitarLogsConsole) return;

        let dataAgora = new Date();
        let dataFormatada = `${dataAgora.getDate().toString().padStart(2, '0')}/${(dataAgora.getMonth() + 1).toString().padStart(2, '0')}/${dataAgora.getFullYear()} ${dataAgora.getHours().toString().padStart(2, '0')}:${dataAgora.getMinutes().toString().padStart(2, '0')}:${dataAgora.getSeconds().toString().padStart(2, '0')}`;

        let conteudoMsg = ''
        if (typeof msg == 'object') {
            conteudoMsg = JSON.stringify(msg);
        } else {
            conteudoMsg = msg;
        }

        console.log(`[${dataFormatada}] [CompactLogix] - ${conteudoMsg}`);
    }
}

/**
 * Esses são os Data Types suportados e especificos pro CompactLogix.
 */
export const DataTypes = {
    /**
     * Tipos de DataTypes atomicos(numeros) suportados
     * Contém o código do tipo de dado, a descrição e o tamanho em bytes
     */
    atomicos: {
        /**
         * Boolean, tamanho 1, unsigned 
         */
        BOOL: {
            codigo: 193,
            descricao: 'Boolean',
            tamanho: 1,
            isSigned: false
        },
        /**
         * Small Int, tamanho 1, signed
         */
        SINT: {
            codigo: 194,
            descricao: 'Small Int',
            tamanho: 1,
            isSigned: true
        },
        /**
         * Int, tamanho 2, signed
         */
        INT: {
            codigo: 195,
            descricao: 'Int',
            tamanho: 2,
            isSigned: true
        },
        /**
         * Double Int, tamanho 4, signed
         */
        DINT: {
            codigo: 196,
            descricao: 'Double Int',
            tamanho: 4,
            isSigned: true
        },
        /**
           * Unsigned Long Int, tamanho 8, signed
           */
        LINT: {
            codigo: 197,
            descricao: 'Long Int',
            tamanho: 8,
            isSigned: true
        },
        /**
         * Unsigned Small Int, tamanho 1, unsigned
         */
        USINT: {
            codigo: 198,
            descricao: 'Unsigned Small Int',
            tamanho: 1,
            isSigned: false
        },
        /**
         * Unsigned Int, tamanho 2, unsigned
         */
        UINT: {
            codigo: 199,
            descricao: 'Unsigned Int',
            tamanho: 2,
            isSigned: false
        },
        /**
         * Unsigned Double Int, tamanho 4, unsigned
         */
        UDINT: {
            codigo: 200,
            descricao: 'Unsigned Double Int',
            tamanho: 4,
            isSigned: false
        },
        /**
         * Unsigned Long Int, tamanho 8, unsigned
         */
        REAL: {
            codigo: 202,
            descricao: 'Real',
            tamanho: 4,
            isSigned: true
        }
    },
    /**
     * Structs são tipos "objetos", que contém apenas mais que um simples numero
     */
    structs: {
        ASCIISTRING82: {
            descricao: 'String ASCII de 82 bytes',
            codigoTipoStruct: 4046
        }
    }
}