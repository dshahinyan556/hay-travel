using System.ComponentModel;

namespace ATTours.Common.Enums
{
    public enum SymbolType : byte
    {
        [Description(" ")]
        Space = (byte)' ',

        [Description("\'")]
        SingleQuotationMarks = (byte)'\'',

        [Description("\"")]
        QuotationMarks = (byte)'\"',

        [Description(",")]
        Comma = (byte)',',

        [Description(".")]
        Dot = (byte)'.',

        [Description("/")]
        Slash = (byte)'/',

        [Description("\\")]
        Backslash = (byte)'\\',

        [Description("-")]
        Dash = (byte)'-',

        [Description("_")]
        Underscore = (byte)'_',

        [Description(":")]
        Colon = (byte)':',

        [Description(";")]
        Semicolon = (byte)';',

        [Description("|")]
        Pipe = (byte)'|',

        [Description("*")]
        Asterisk = (byte)'*',

        [Description("?")]
        QuestionMark = (byte)'?',

        [Description("&")]
        Ampersand = (byte)'&',

        [Description("=")]
        Equals = (byte)'=',

        [Description("+")]
        Plus = (byte)'+',

        [Description("#")]
        Hash = (byte)'#',

        [Description("%")]
        Percent = (byte)'%',

        [Description("$")]
        Dollar = (byte)'$',

        [Description("@")]
        At = (byte)'@',

        [Description("!")]
        Exclamation = (byte)'!',

        [Description("~")]
        Tilde = (byte)'~',

        [Description("(")]
        OpenParenthesis = (byte)'(',

        [Description(")")]
        CloseParenthesis = (byte)')',

        [Description("[")]
        OpenBracket = (byte)'[',

        [Description("]")]
        CloseBracket = (byte)']',

        [Description("{")]
        OpenBrace = (byte)'{',

        [Description("}")]
        CloseBrace = (byte)'}',

        [Description("<")]
        LessThan = (byte)'<',

        [Description(">")]
        GreaterThan = (byte)'>'
    }
}
