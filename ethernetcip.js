import net from "net";

async function iniciar() {
    console.log(`Iniciando...`);

    const socketConexao = new net.Socket();

    let sessionHandleAtual = -1;

    const montarComandoDeObterSessao = () => {
        const buffer = Buffer.alloc(28);

        // Comando Register Session (0x65)
        buffer.writeUInt16LE(0x0065, 0);
        // Comprimento (4 bytes - protocol version + options)
        buffer.writeUInt16LE(0x0004, 2);
        // Session Handle (inicialmente 0)
        buffer.writeUInt32LE(0x00000000, 4);
        // Status (não utilizado no request)
        buffer.writeUInt32LE(0x00000000, 8);
        // Sender Context (8 bytes de zeros)
        buffer.writeUInt32LE(0x00000000, 12);
        buffer.writeUInt32LE(0x00000000, 16);
        // Options (inicialmente 0)
        buffer.writeUInt32LE(0x00000000, 20);

        // Versão do protocolo (1)
        buffer.writeUInt16LE(0x0001, 24);
        // Opções (0)
        buffer.writeUInt16LE(0x0000, 26);


        return buffer;
    }

    const montarComandoListaServicos = () => {
        const buffer = Buffer.alloc(24);

        // Comando List Services (0x4)
        buffer.writeUInt16LE(0x0004, 0);
        // Comprimento (0 bytes pois não tem nada adicional no header)
        buffer.writeUInt16LE(0x0000, 2);
        // Session Handle
        buffer.writeUInt32LE(0x00000000, 4);
        // Status (não utilizado no request)
        buffer.writeUInt32LE(0x00000000, 8);
        // Sender Context (8 bytes de zeros)
        buffer.writeUInt32LE(0x00000000, 12);
        buffer.writeUInt32LE(0x00000000, 16);
        // Options (inicialmente 0)
        buffer.writeUInt32LE(0x00000000, 20);

        return buffer;
    }


    const montarComandoListaIdentidade = () => {
        const buffer = Buffer.alloc(24);

        // Comando de Listar Identidade (0x63)
        buffer.writeUInt16LE(0x0063, 0);
        // Comprimento (0 bytes pois não tem nada adicional no header)
        buffer.writeUInt16LE(0x0000, 2);
        // Session Handle
        buffer.writeUInt32LE(0x00000000, 4);
        // Status (não utilizado no request)
        buffer.writeUInt32LE(0x00000000, 8);
        // Sender Context (8 bytes de zeros)
        buffer.writeUInt32LE(0x00000000, 12);
        buffer.writeUInt32LE(0x00000000, 16);
        // Options (inicialmente 0)
        buffer.writeUInt32LE(0x00000000, 20);

        return buffer;
    }

    const conectarSocket = () => {
        socketConexao.connect({ host: '192.168.3.120', port: 44818 }, () => {
            console.log(`Conexão TCP estabelecida`);

            const comandoConectar = montarComandoDeObterSessao();

            socketConexao.write(comandoConectar);
        });

        socketConexao.on('data', (data) => {
            processaBufferRecebido(data);
        });

        socketConexao.on('end', () => {
            console.log('Conexão encerrada pelo servidor');
        });

        socketConexao.on('error', (err) => {
            console.error('Erro:', err);
        });

        socketConexao.on('timeout', () => {
            console.log('Conexão atingiu o tempo limite');
        });

        socketConexao.on('close', (hadError) => {
            console.log(`Conexão fechada${hadError ? ' devido a um erro' : ''}`);
        });
    }

    const processaBufferRecebido =
        /**
         * 
         * @param {Buffer} dados 
         */
        (dados) => {
            console.log(`Processando buffer: ${hexDeBuffer(dados)}`);

            const status = dados.readUInt32LE(8);
            if (status != 0x000) {
                console.log(`Recebido um status diferente de 0 para ENIP: ${status}`);
                return;
            }

            const comandoRecebido = dados.readUInt16LE(0);
            switch (comandoRecebido) {
                // Register session é 2 bytes
                case 0x0065:
                    processaRegisterSession(dados);
                    break;
                case 0x0004: {
                    processaListaServicos(dados);
                    break;
                }
                case 0x0063: {
                    processaListaIdentidade(dados);
                    break;
                }
                default:
                    console.log(`Comando desconhecido: ${comandoRecebido}`);
                    break;
            }
        }

    // Processa a lista de serviços disponíveis que esse dispositivo EtherNet IP suporta
    const processaListaServicos =
        /**
         * 
         * @param {Buffer} dados 
         */
        (dados) => {
            console.log(`Processando comando List Services ${hexDeBuffer(dados)}`);

            // Offset do payload do Command Specific Data, pois o payload EtherNet/IP é composto pelo Header de Encapsulação (24 bytes) + CSD(quantos bytes forem necessarios pra caber)
            // 0 ao 23 é o payload do Header de Encapsulação
            const offsetCSD = 24;

            // Total de serviços é 2 bytes do inicio do Buffer
            const totalServicosDispo = dados.readUInt16LE(offsetCSD, 0);
            if (totalServicosDispo == 0) {
                console.log(`Nenhum serviço disponível para o dispositivo EtherNet/IP`);
                return;
            }

            /**
             * @typedef Servico
             * @property {String} nome - Nome do serviço
             * @property {Number} versao_protocolo_encapsulamento - Versão do protocolo de encapsulamento EtherNet IP do dispositivo(sempre deve ser 1 segundo o manuel '-')
             * @property {Number} codigo_servico - Código do serviço em decimal
             * @property {Object} flags - Flags suportadas pelo serviço
             * @property {Boolean} flags.encapsulamento_cip_via_tcp - Flag que indica se o serviço suporta encapsulamento CIP via TCP
             * @property {Boolean} flags.encapsulamento_cip_via_udp - Flag que indica se o serviço suporta encapsulamento CIP via UDP
             */

            // Segundo a documentação, se o dispositivo suportar, é obrigatorio que ele tenha (eu acho) pelo menos um unico serviço com o hex 0x100 chamado "Communications" com as
            // os tipos de comunicações CIP que o dispositivo suporta;

            let offsetServicoAtual = offsetCSD;

            // Após os 2 bytes da quantidade de serviços, os serviços estão concatenados um atrás do outro

            // Colocar o offset na posição do primeiro serviço pro for

            /**
             * @type {Servico[]}
             */
            const servicos = []

            // Passar por todos os serviços disponiveis
            for (let indexServico = 0; indexServico < totalServicosDispo; indexServico++) {

                /**
                 * @type {Servico}
                 */
                let novoServ = {
                    nome: '',
                    codigo_servico: -1,
                    versao_protocolo_encapsulamento: -1,
                    flags: {
                        encapsulamento_cip_via_tcp: false,
                        encapsulamento_cip_via_udp: false
                    }
                }

                // Os proximos 2 bytes é o tipo do serviço
                const tipoServico = dados.readUInt16LE(offsetServicoAtual + 2);

                // Os proximos 2 bytes é o tamanho em bytes do payload de versão + flags + nome do serviço
                const tamanhoPayload = dados.readUInt16LE(offsetServicoAtual + 4);

                // Os proximos 2 bytes é a versão do protocolo de encapsulamento
                const versaoProtocoloEncapsulamento = dados.readUInt16LE(offsetServicoAtual + 6);

                // Os proximos 2 bytes é as flags suportadas pelo serviço
                const flagsSuportadasNoServico = dados.readUInt16LE(offsetServicoAtual + 8);

                // Os proximos 16 bytes é o nome do serviço
                const nomeServico = dados.toString('ascii', offsetServicoAtual + 10, (offsetServicoAtual + 10) + 16)

                // Se tiver mais serviços, mover o offset para o proximo serviço
                // Offset do serviço anterior + tamanho do payload dele + 2 bytes do tamanho do payload do serviço atual
                offsetServicoAtual = offsetServicoAtual + tamanhoPayload + 2 + 2;

                novoServ.nome = nomeServico.replace(/[^a-zA-Z0-9]/g, '');
                novoServ.versao_protocolo_encapsulamento = versaoProtocoloEncapsulamento;
                novoServ.codigo_servico = tipoServico;
                novoServ.flags = {
                    ...novoServ.flags,
                    encapsulamento_cip_via_tcp: (flagsSuportadasNoServico & (1 << 5)) !== 0,
                    encapsulamento_cip_via_udp: (flagsSuportadasNoServico & (1 << 8)) !== 0
                }

                servicos.push(novoServ);
            }

            console.log(`Lista de serviços disponiveis no dispositivo remoto:`);
            for (const servico of servicos) {
                let informacoesServico = `----[${servico.nome}]---`;
                informacoesServico += `\nVersão do protocolo de encapsulamento: ${servico.versao_protocolo_encapsulamento}`;
                informacoesServico += `\nCódigo do Serviço: ${servico.codigo_servico}`;
                informacoesServico += `\nFlags suportadas:`;
                informacoesServico += `\n\tEncapsulamento CIP via TCP: ${servico.flags.encapsulamento_cip_via_tcp}`;
                informacoesServico += `\n\tEncapsulamento CIP via UDP: ${servico.flags.encapsulamento_cip_via_udp}`;
                informacoesServico += `\n--------`;

                console.log(informacoesServico);;

            }

        }

    const processaRegisterSession = (dados) => {
        console.log(`Processando comando Register Session ${hexDeBuffer(dados)}`);
        const sessionHandle = dados.readUInt32LE(4);
        console.log(`Session Handle: ${sessionHandle}`);

        sessionHandleAtual = sessionHandle;

        iniciarTestes();
    }

    const processaListaIdentidade =
        /**
         * 
         * @param {Buffer} dados 
         * @returns 
         */
        (dados) => {
            console.log(`Processando comando List Identity ${hexDeBuffer(dados)}`);

            // Offset do payload do Command Specific Data, pois o payload EtherNet/IP é composto pelo Header de Encapsulação (24 bytes) + CSD(quantos bytes forem necessarios pra caber)
            let offsetCSD = 24;

            // Os próximos 2 bytes contém a quantidade de itens retornados pelo dispositivo
            let identidadesRetornadas = dados.readUInt16LE(offsetCSD, 0);

            if (identidadesRetornadas == 0) {
                console.log(`Nenhuma identidade retornada pelo dispositivo EtherNet/IP`);
                return;
            }

            const extrairEnderecoIp = (buffer) => {
                const octeto1 = (buffer >> 24) & 0xFF;
                const octeto2 = (buffer >> 16) & 0xFF;
                const octeto3 = (buffer >> 8) & 0xFF;
                const octeto4 = buffer & 0xFF;

                return `${octeto1}.${octeto2}.${octeto3}.${octeto4}`;
            }

            const extrairEnderecoZeros =
                /**
                 * 
                 * @param {Buffer} buffer 
                 */
                (buffer) => {

                    let padding = '';

                    // Ler os valores de USINT (1 byte cada)
                    for (let i = 0; i < 8; i++) {
                        const usintValue = buffer.readUInt8(i);  // Lê 1 byte de cada vez
                        padding += `${usintValue}`
                    }

                    return padding;
                }



            /**
             * Informações de uma identidade CIP do dispositivo
             * @typedef IdentidadeCIP
             * @property {Number} tipo - Tipo da identidade (codigo decimal)
             * @property {Number} versao_protocolo_encapsulamento - Versão do protocolo de encapsulamento EtherNet/IP do dispositivo(sempre deve ser 1 segundo o manuel '-')
             * @property {Object} endereco_socket - Endereço do socket do dispositivo
             * @property {Number} endereco_socket.familia - Família do endereço do socket
             * @property {Number} endereco_socket.porta - Porta do endereço do socket
             * @property {String} endereco_socket.endereco - Endereço IP do socket
             * @property {String} endereco_socket.zeros - Zeros do endereço do socket
             * @property {Number} fabricante_id - ID do fabricante do dispositivo (decimal)
             * @property {Number} tipo_dispositivo - Tipo do dispositivo (decimal)
             * @property {Number} codigo_produto - Código do produto (decimal)
             * @property {String} versao_revisao - Versão de revisão do dispositivo
             * @property {Number} status_dispositivo - Status do dispositivo (decimal)
             * @property {Number} numero_serial - Número serial do dispositivo
             * @property {Number} tamanho_nome_dispositivo - Tamanho do nome do dispositivo
             * @property {String} nome_dispositivo - Nome do dispositivo
             * @property {Number} estado_dispositivo - Estado do dispositivo
             */

            /**
             * Extrair dados do buffer do Identity CIP e dar parse
             * @param {Buff} buffCIP 
             */
            const carregarIdentidadeCIP = (buffCIP) => {

                console.log(`Processando identidade CIP ${hexDeBuffer(buffCIP)}`);
                

                // Os próximos 2 bytes é a versão do protocolo de encapsulamento (geralmente sempre 1)
                const versaoEncapsulamento = buffCIP.readUInt16LE(0);

                const enderecoSocket = {
                    familia: buffCIP.readInt16BE(2),
                    porta: buffCIP.readUInt16BE(4),
                    endereco: extrairEnderecoIp(buffCIP.readUInt32BE(6)),
                    zeros: extrairEnderecoZeros(buffCIP.subarray(10, 10 + 8))
                }

                // Os próximos 2 bytes após o sin_zeros é o Vendor ID
                const fabricanteId = buffCIP.readUInt16LE(18)

                // Os próximos 2 bytes são o Device Type
                const tipoDispositivo = buffCIP.readUInt16LE(20)

                // Os próximos 2 bytes são o Product Code
                const codigoProduto = buffCIP.readUInt16LE(22)

                // Os próximos 2 bytes são o Revision
                const versaoRevisao = buffCIP.subarray(24, 24 + 2).join('.');

                // Os próximos 2 bytes são o Status
                const statusDispositivo = buffCIP.readUInt16LE(26)

                // Os próximos 4 bytes são o Serial Number
                const numeroSerial = buffCIP.readUInt32LE(28)

                // Os próximos 1 byte é o tamanho do nome do produto
                const tamanhoNomeDispositivo = buffCIP.readUInt8(32)

                // O nome do produto é o próximo byte até o tamanho do nome do produto
                const nomeDispositivo = buffCIP.toString('ascii', 33, 33 + tamanhoNomeDispositivo)

                // O próximo byte é o estado do dispositivo
                const estadoDispositivo = buffCIP.readUInt8(33 + tamanhoNomeDispositivo)

                /**
                 * @type {IdentidadeCIP}
                 */
                const identCip = {
                    tipo: 0x000c,
                    versao_protocolo_encapsulamento: versaoEncapsulamento,
                    endereco_socket: {
                        endereco: enderecoSocket.endereco,
                        familia: enderecoSocket.familia,
                        porta: enderecoSocket.porta,
                        zeros: enderecoSocket.zeros
                    },
                    fabricante_id: fabricanteId,
                    tipo_dispositivo: tipoDispositivo,
                    codigo_produto: codigoProduto,
                    versao_revisao: versaoRevisao,
                    status_dispositivo: statusDispositivo,
                    numero_serial: numeroSerial,
                    tamanho_nome_dispositivo: tamanhoNomeDispositivo,
                    nome_dispositivo: nomeDispositivo,
                    estado_dispositivo: estadoDispositivo
                }

                return identCip;
            }

            // Após os 2 bytes da quantidade de identidades, as identidades estão concatenadas uma atrás da outra

            // Passar por todas as identidades existentes. 
            for (let indexIdentidade = 0; indexIdentidade < identidadesRetornadas; indexIdentidade++) {

                // Os próximos 2 bytes é tipo da identidade
                const tipoIdentidade = dados.readUInt16LE(offsetCSD + 2);

                switch (tipoIdentidade) {
                    // ID do CIP Identity
                    case 0x000c:

                        // Os próximos 2 bytes é o tamanho em bytes do payload total dessa identidade que é composto por
                        //* Encapsulation Protocol Version: 2 bytes
                        //* Socket Address: 16 bytes
                        //* Vendor ID: 2 bytes
                        //* Device Type: 2 bytes
                        //* Product Code: 2 bytes
                        //* Revision: 2 bytes
                        //* Status: 2 bytes
                        //* Serial Number: 4 bytes
                        //* Product Name Length: 1 byte
                        //* Product Name: (equivalente ao Product Name Length)
                        //* State: 1 byte
                        const tamanhoPayloadBytes = dados.readUInt16LE(offsetCSD + 4);

                        // Cortar o buffer onde inicio a identidade CIP
                        let identidadeCIPDados = carregarIdentidadeCIP(dados.subarray(offsetCSD + 6, offsetCSD + 6 + tamanhoPayloadBytes))
                        console.log(identidadeCIPDados);
                        
                        // Mover o offset para a próxima identidade disponivel. Sendo o offset do payload do Identity CIP + 2 byte do tamanho do payload do Identity CIP) + 2 byte do tipo da identidade CIP);
                        offsetCSD += tamanhoPayloadBytes + 2 + 2
                        break;
                    default: {
                        console.log(`Identidade desconhecida: ${tipoIdentidade}`);
                        break;
                    }
                }
            }
        }

    // Inicia o testes que eu quero dps do register session
    const iniciarTestes = async () => {
        console.log(`Iniciando testes agora..`);

        console.log(`Solicitando lista de serviços disponíveis`);

    
    }

    conectarSocket();
}

function hexDeBuffer(buff) {
    return buff.toString('hex').match(/.{1,2}/g).join(' ')
}

iniciar();