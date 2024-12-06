
/**
 * Retorna uma string na representação hexadecimal de um buffer
 * @param {Buffer} buff 
 */
export function hexDeBuffer(buff) {
    if (buff.length == 0) return '[Vazio]';
    
    return buff.toString('hex').match(/.{1,2}/g).join(' ')
}

/**
 * Converte um numero para sua representação hexadecimal em x bytes
 * @param {Number} numero - Numero a ser convertido
 * @param {Number} bytes - Numero de bytes que o numero deve ocupar
 * @returns 
 */
export function numeroToHex(numero, bytes) {
    const hexValue = numero.toString(16).padStart(bytes * 2, '0');
    return `0x${hexValue}`;
}


/**
 * Substitui placeholders em um template com informações de uma data
 * @param {Date} date 
 * @param {string} template 
 * @returns {string}
 */
export function DateParaString(date, template = '') {
    const pad = (num, padDesejado = 2) => num.toString().padStart(padDesejado, '0');

    const replacements = {
        '%ano%': date.getFullYear(),
        '%mes%': pad(date.getMonth() + 1),
        '%dia%': pad(date.getDate()),
        '%hora%': pad(date.getHours()),
        '%minuto%': pad(date.getMinutes()),
        '%segundo%': pad(date.getSeconds()),
        '%milissegundo%': pad(date.getMilliseconds(), 3)
    };


    return template.replace(/%ano%|%mes%|%dia%|%hora%|%minuto%|%segundo%|%milissegundo%/g, match => replacements[match]);
}