// 8-bit ALU with flags
module alu(input [7:0] a, b, input [2:0] op, output reg [7:0] y, output reg carry, output zero);
  always @(*) begin
    carry = 0;
    case (op)
      3'b000: {carry, y} = a + b;
      3'b001: {carry, y} = a - b;
      3'b010: y = a & b;
      3'b011: y = a | b;
      3'b100: y = a ^ b;
      3'b101: y = ~a;
      3'b110: y = a << 1;
      3'b111: y = a >> 1;
      default: y = 8'h00;
    endcase
  end
  assign zero = (y == 0);
endmodule
module tb;
  reg [7:0] a, b; reg [2:0] op; wire [7:0] y; wire c, z;
  alu u(.a(a), .b(b), .op(op), .y(y), .carry(c), .zero(z));
  integer k;
  initial begin
    a = 8'hC8; b = 8'h64;
    for (k = 0; k < 8; k = k + 1) begin op = k; #1 $display("op=%b a=%h b=%h y=%h carry=%b zero=%b", op, a, b, y, c, z); end
    a = 8'h10; b = 8'h10; op = 3'b001; #1 $display("sub equal: y=%h zero=%b carry=%b", y, z, c);
    $finish;
  end
endmodule
